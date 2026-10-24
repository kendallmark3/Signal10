import Foundation

enum Signal10Error: Error, Equatable, LocalizedError {
    case signedOut
    case wrongCredentials
    case locked
    case architectNotConfigured(String)
    case server(String)
    case network

    // The sign-in messages are the server's own (SIGN_IN_MESSAGES in server.js).
    var errorDescription: String? {
        switch self {
        case .signedOut: "Sign in to use Signal10."
        case .wrongCredentials: "That username and password did not match. Try again."
        case .locked: "Too many failed attempts. Wait a minute, then try again."
        case .architectNotConfigured(let message), .server(let message): message
        case .network: "Could not reach Signal10. Check your connection and try again."
        }
    }
}

/// The app's only connection to Signal10: the same /login, /api/top10 and /api/architect routes
/// the web page uses. The session cookie is kept by the session's cookie store.
final class Signal10Client: Sendable {
    let baseURL: URL
    private let session: URLSession

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func signIn(username: String, password: String) async throws {
        var request = URLRequest(url: baseURL.appending(path: "login"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("username=\(Self.formEncode(username))&password=\(Self.formEncode(password))".utf8)

        // The server answers with a redirect: to / on success, back to /login?… on failure.
        let (_, response) = try await load(request, followRedirects: false)
        let location = response.value(forHTTPHeaderField: "Location") ?? ""
        if response.statusCode == 302, location == "/" { return }
        if location.contains("locked") { throw Signal10Error.locked }
        if location.contains("error") { throw Signal10Error.wrongCredentials }
        throw Signal10Error.server("Signal10 gave an unexpected answer to sign-in (\(response.statusCode)).")
    }

    func signOut() async {
        var request = URLRequest(url: baseURL.appending(path: "logout"))
        request.httpMethod = "POST"
        _ = try? await load(request, followRedirects: false)
        let cookies = session.configuration.httpCookieStorage
        cookies?.cookies(for: baseURL)?.forEach { cookies?.deleteCookie($0) }
    }

    func top10(topic: String) async throws -> Top10Response {
        try await get("api/top10", topic: topic)
    }

    func architect(topic: String) async throws -> ArchitectResponse {
        try await get("api/architect", topic: topic)
    }

    private func get<Reply: Decodable>(_ path: String, topic: String) async throws -> Reply {
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "topic", value: topic)]
        guard let url = components?.url else { throw Signal10Error.network }
        var request = URLRequest(url: url)
        // Architect View can take up to a minute (README, Known limitations).
        request.timeoutInterval = 120

        let (data, response) = try await load(request, followRedirects: true)
        switch response.statusCode {
        case 200:
            do { return try JSONDecoder().decode(Reply.self, from: data) } catch {
                throw Signal10Error.server("Signal10 sent a reply this app could not read.")
            }
        case 401:
            throw Signal10Error.signedOut
        default:
            let body = try? JSONDecoder().decode(ErrorBody.self, from: data)
            let message = body?.error ?? "Signal10 could not answer just now (\(response.statusCode))."
            if body?.code == "not_configured" { throw Signal10Error.architectNotConfigured(message) }
            throw Signal10Error.server(message)
        }
    }

    private struct ErrorBody: Decodable {
        let error: String
        let code: String?
    }

    private func load(_ request: URLRequest, followRedirects: Bool) async throws -> (Data, HTTPURLResponse) {
        do {
            let (data, response) = try await session.data(for: request, delegate: followRedirects ? nil : NoRedirects.shared)
            guard let http = response as? HTTPURLResponse else { throw Signal10Error.network }
            return (data, http)
        } catch let error as Signal10Error {
            throw error
        } catch {
            throw Signal10Error.network
        }
    }

    private static func formEncode(_ value: String) -> String {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._*")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
    }
}

private final class NoRedirects: NSObject, URLSessionTaskDelegate, Sendable {
    static let shared = NoRedirects()

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest) async -> URLRequest? {
        nil
    }
}
