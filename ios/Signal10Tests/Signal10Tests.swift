import Foundation
import Testing
@testable import Signal10

private func fixture(_ name: String) throws -> Data {
    let url = try #require(Bundle(for: BundleMarker.self).url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
    return try Data(contentsOf: url)
}
private final class BundleMarker {}

// MARK: 1, 2, 3 — decoding the server's reply

@Suite struct DecodingTests {
    @Test func realReplyDecodes() throws {
        let reply = try JSONDecoder().decode(Top10Response.self, from: fixture("top10-swift-concurrency"))
        #expect(reply.topic == "Swift concurrency")
        #expect(reply.results.count == 10)
        let first = reply.results[0]
        #expect(first.rank == 1)
        #expect(first.id == "E95agtPgaa0")
        #expect(first.title == "Q&A: Swift concurrency | Meet with Apple")
        #expect(first.channel == "Apple Developer")
        #expect(first.thumbnail?.host == "i.ytimg.com")
        #expect(first.durationText == "1:03:49")
        #expect(first.score == 93)
        #expect(first.headline == "Gaining views fast")
        #expect(first.reason.hasPrefix("It covers the whole topic"))
        #expect(first.rankByViews == 2)
        #expect(reply.learningPath.count == 10)
        #expect(reply.learningPath.map(\.step) == Array(1...10))
        #expect(reply.learningPath[0].stage == "Foundation / overview")
        #expect(reply.learningPath[0].pathReason.contains("introductory"))
    }

    @Test func missingFieldsStayEmpty() throws {
        let reply = try JSONDecoder().decode(Top10Response.self, from: fixture("top10-sparse"))
        let video = reply.results[0]
        #expect(video.views == nil)
        #expect(video.durationText == nil)
        #expect(video.durationSeconds == nil)
        #expect(video.publishedDate == nil)
        #expect(video.publishedText == nil)
        #expect(video.thumbnail == nil)
        #expect(video.missingWords == ["pyhton", "beginers"])
        #expect(reply.suggestion == "python for beginners")
        let book = try #require(reply.reading.first)
        #expect(book.authors == nil)
        #expect(book.cover == nil)
        #expect(book.year == nil)
    }

    @Test func architectReplyDecodes() throws {
        let reply = try JSONDecoder().decode(ArchitectResponse.self, from: fixture("architect"))
        #expect(reply.view.sequence.count == 2)
        #expect(reply.view.sequence[0].video?.rank == 1)
        #expect(reply.view.sequence[1].reading?.number == 1)
        #expect(reply.view.keyConcepts == ["async/await", "actors"])
    }

    @Test func pathGroupsIntoStagesInServerOrder() throws {
        let reply = try JSONDecoder().decode(Top10Response.self, from: fixture("top10-swift-concurrency"))
        let stages = reply.stages
        #expect(stages.map(\.name) == orderedUnique(reply.learningPath.map(\.stage)))
        #expect(stages.flatMap(\.steps).map(\.step) == Array(1...10))
    }

    private func orderedUnique(_ names: [String]) -> [String] {
        var seen = Set<String>()
        return names.filter { seen.insert($0).inserted }
    }
}

// MARK: 4 — topic cleaning

@Suite struct TopicTests {
    @Test func cleansLikeTheServer() {
        #expect(Topic.clean("  AWS   AgentCore \n") == "AWS AgentCore")
    }

    @Test func rejectsTooShortOrTooLong() {
        #expect(Topic.clean("a") == nil)
        #expect(Topic.clean("   ") == nil)
        #expect(Topic.clean(String(repeating: "x", count: 121)) == nil)
        #expect(Topic.clean(String(repeating: "x", count: 120)) != nil)
    }
}

// MARK: 5, 6 — talking to the server

@Suite(.serialized) struct ClientTests {
    let base = URL(string: "https://signal10.test")!

    private func client() -> Signal10Client {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        return Signal10Client(baseURL: base, session: URLSession(configuration: config))
    }

    @Test func signInPostsFormAndAcceptsRedirectHome() async throws {
        StubProtocol.reply = { request in
            #expect(request.httpMethod == "POST")
            #expect(request.url?.path == "/login")
            #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/x-www-form-urlencoded")
            #expect(String(data: request.bodyData ?? Data(), encoding: .utf8) == "username=me%40x&password=p%26ss%3Dword")
            return (302, ["Location": "/", "Set-Cookie": "signal10_session=1.abc; Path=/; HttpOnly"], Data())
        }
        try await client().signIn(username: "me@x", password: "p&ss=word")
    }

    @Test func wrongPasswordAndLockout() async {
        StubProtocol.reply = { _ in (302, ["Location": "/login?error=1"], Data()) }
        await #expect(throws: Signal10Error.wrongCredentials) { try await client().signIn(username: "a", password: "b") }
        StubProtocol.reply = { _ in (302, ["Location": "/login?locked=1"], Data()) }
        await #expect(throws: Signal10Error.locked) { try await client().signIn(username: "a", password: "b") }
    }

    @Test func top10SendsTopicAndDecodes() async throws {
        let body = try fixture("top10-swift-concurrency")
        StubProtocol.reply = { request in
            #expect(request.url?.path == "/api/top10")
            #expect(URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.first?.value == "Swift concurrency")
            return (200, ["Content-Type": "application/json"], body)
        }
        let reply = try await client().top10(topic: "Swift concurrency")
        #expect(reply.results.count == 10)
    }

    @Test func unauthorizedMeansSignedOut() async {
        StubProtocol.reply = { _ in (401, [:], Data(#"{"error":"Sign in to use Signal10."}"#.utf8)) }
        await #expect(throws: Signal10Error.signedOut) { try await client().top10(topic: "Swift") }
    }

    @Test func serverMessageIsShown() async {
        StubProtocol.reply = { _ in (502, [:], Data(#"{"error":"Could not reach YouTube just now. Try again in a moment."}"#.utf8)) }
        await #expect(throws: Signal10Error.server("Could not reach YouTube just now. Try again in a moment.")) {
            try await client().top10(topic: "Swift")
        }
    }

    @Test func architectNotConfiguredIsItsOwnCase() async {
        StubProtocol.reply = { _ in (503, [:], Data(#"{"error":"Architect View is not set up.","code":"not_configured"}"#.utf8)) }
        await #expect(throws: Signal10Error.architectNotConfigured("Architect View is not set up.")) {
            try await client().architect(topic: "Swift")
        }
    }
}

// MARK: 7 — recent searches, following public/recent.js

@Suite struct RecentTests {
    @Test func newestFirstAndAtMostFive() {
        var list: [String] = []
        for topic in ["a1", "a2", "a3", "a4", "a5", "a6"] { list = RecentSearches.add(list, topic) }
        #expect(list == ["a6", "a5", "a4", "a3", "a2"])
    }

    @Test func repeatMovesToFront() {
        let list = RecentSearches.add(["Swift", "AWS AgentCore"], "  aws   agentcore ")
        #expect(list == ["aws agentcore", "Swift"])
    }

    @Test func blankIsNotKept() {
        #expect(RecentSearches.add(["Swift"], "   ") == ["Swift"])
    }

    @Test func survivesStorageAndIgnoresJunk() throws {
        let defaults = try #require(UserDefaults(suiteName: "recent-\(UUID())"))
        RecentSearches.save(["Swift", "AWS"], to: defaults)
        #expect(RecentSearches.load(from: defaults) == ["Swift", "AWS"])
        defaults.set("not a list", forKey: RecentSearches.storageKey)
        #expect(RecentSearches.load(from: defaults) == [])
        defaults.set([1, "Swift", "  "], forKey: RecentSearches.storageKey)
        #expect(RecentSearches.load(from: defaults) == ["Swift"])
    }
}

// MARK: 8 — watched videos and "Up next"

@Suite struct ProgressTests {
    @Test func watchedIsPerTopicIgnoringCase() throws {
        let progress = LearningProgress(defaults: try #require(UserDefaults(suiteName: "progress-\(UUID())")))
        progress.setWatched(true, videoID: "E95agtPgaa0", topic: "Swift Concurrency")
        #expect(progress.isWatched("E95agtPgaa0", topic: "swift concurrency"))
        #expect(!progress.isWatched("E95agtPgaa0", topic: "AWS AgentCore"))
        progress.setWatched(false, videoID: "E95agtPgaa0", topic: "SWIFT CONCURRENCY")
        #expect(!progress.isWatched("E95agtPgaa0", topic: "Swift concurrency"))
    }

    @Test func upNextIsFirstUnwatchedStep() throws {
        let reply = try JSONDecoder().decode(Top10Response.self, from: fixture("top10-swift-concurrency"))
        let progress = LearningProgress(defaults: try #require(UserDefaults(suiteName: "progress-\(UUID())")))
        let path = reply.learningPath
        #expect(progress.upNext(in: path, topic: reply.topic)?.step == 1)
        progress.setWatched(true, videoID: path[0].video.id, topic: reply.topic)
        progress.setWatched(true, videoID: path[2].video.id, topic: reply.topic)
        #expect(progress.upNext(in: path, topic: reply.topic)?.step == 2)
        for step in path { progress.setWatched(true, videoID: step.video.id, topic: reply.topic) }
        #expect(progress.upNext(in: path, topic: reply.topic) == nil)
    }
}

// MARK: 9 — the player

@Suite struct PlayerTests {
    @Test func onlyValidIDsGetAPlayer() {
        #expect(YouTubeEmbed.url(videoID: "E95agtPgaa0") != nil)
        #expect(YouTubeEmbed.url(videoID: "short") == nil)
        #expect(YouTubeEmbed.url(videoID: "E95agtPgaa0\"><script>") == nil)
        #expect(YouTubeEmbed.url(videoID: "../../evil1") == nil)
    }

    @Test func embedIsNoCookieAndInline() throws {
        let url = try #require(YouTubeEmbed.url(videoID: "E95agtPgaa0"))
        #expect(url.host == "www.youtube-nocookie.com")
        #expect(url.path == "/embed/E95agtPgaa0")
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        #expect(items.contains(URLQueryItem(name: "playsinline", value: "1")))
    }
}

// MARK: 10 — settings hold the address and nothing secret

@Suite struct ConfigTests {
    @Test func baseURLComesFromSettings() throws {
        let url = try #require(AppConfig.baseURL)
        #expect(url.scheme == "http" || url.scheme == "https")
        #expect(url.host != nil)
    }

    @Test func noKeyOrModelInSettings() throws {
        let plist = try #require(Bundle(for: Signal10Client.self).infoDictionary)
        let flattened = plist.map { "\($0.key)=\($0.value)" }.joined(separator: "\n").lowercased()
        for banned in ["sk-ant", "anthropic", "api_key", "apikey", "openai", "claude-", "secret", "password"] {
            #expect(!flattened.contains(banned), "Info.plist mentions \(banned)")
        }
    }
}

// MARK: - URLProtocol stub

final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var reply: (URLRequest) -> (Int, [String: String], Data) = { _ in (500, [:], Data()) }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        let (status, headers, body) = Self.reply(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }
}

private extension URLRequest {
    // URLSession moves a POST body into a stream before a URLProtocol sees it.
    var bodyData: Data? {
        if let httpBody { return httpBody }
        guard let stream = httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }
}
