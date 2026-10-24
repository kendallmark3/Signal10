import Foundation

enum AppConfig {
    /// The Signal10 server, from SIGNAL10_BASE_URL in ios/Config/*.xcconfig. The app holds no other setting.
    static var baseURL: URL? {
        (Bundle.main.object(forInfoDictionaryKey: "Signal10BaseURL") as? String).flatMap(URL.init(string:))
    }
}

enum Topic {
    /// The server's rule (server.js): trimmed, inner spaces collapsed, 2 to 120 characters.
    static func clean(_ raw: String) -> String? {
        let topic = tidy(raw)
        return (2...120).contains(topic.count) ? topic : nil
    }

    static func tidy(_ raw: String) -> String {
        raw.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    /// The server keys its cache by lower-cased topic; progress uses the same identity.
    static func key(_ topic: String) -> String { tidy(topic).lowercased() }
}

/// The five most recent searches, with the same rules as public/recent.js.
enum RecentSearches {
    static let storageKey = "signal10.recent"
    static let limit = 5

    static func add(_ list: [String], _ topic: String) -> [String] {
        let added = Topic.tidy(topic)
        guard !added.isEmpty else { return list }
        return Array(([added] + list.filter { $0.lowercased() != added.lowercased() }).prefix(limit))
    }

    static func load(from defaults: UserDefaults = .standard) -> [String] {
        guard let saved = defaults.array(forKey: storageKey) else { return [] }
        return Array(saved.compactMap { $0 as? String }.filter { !Topic.tidy($0).isEmpty }.prefix(limit))
    }

    static func save(_ list: [String], to defaults: UserDefaults = .standard) {
        defaults.set(list, forKey: storageKey)
    }

    static func clear(in defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: storageKey)
    }
}

/// Which videos the user has watched, per topic, on this device.
final class LearningProgress: @unchecked Sendable {
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    private static let prefix = "signal10.watched."
    private func storageKey(_ topic: String) -> String { Self.prefix + Topic.key(topic) }

    private func watched(_ topic: String) -> Set<String> {
        Set(defaults.stringArray(forKey: storageKey(topic)) ?? [])
    }

    func isWatched(_ videoID: String, topic: String) -> Bool {
        watched(topic).contains(videoID)
    }

    func setWatched(_ isWatched: Bool, videoID: String, topic: String) {
        var ids = watched(topic)
        if isWatched { ids.insert(videoID) } else { ids.remove(videoID) }
        defaults.set(ids.sorted(), forKey: storageKey(topic))
    }

    /// Forgets every topic's watched videos.
    func clearAll() {
        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix(Self.prefix) {
            defaults.removeObject(forKey: key)
        }
    }

    /// The first step of the path not yet watched, or nil when the path is finished.
    func upNext(in path: [PathStep], topic: String) -> PathStep? {
        let ids = watched(topic)
        return path.sorted { $0.step < $1.step }.first { !ids.contains($0.video.id) }
    }
}

enum YouTubeEmbed {
    private static let idCharacters = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")

    /// The same privacy-enhanced player the web page uses, built from the video id alone.
    static func url(videoID: String, autoplay: Bool = true) -> URL? {
        guard videoID.count == 11, videoID.unicodeScalars.allSatisfy(idCharacters.contains) else { return nil }
        var components = URLComponents(string: "https://www.youtube-nocookie.com/embed/\(videoID)")
        components?.queryItems = [
            URLQueryItem(name: "playsinline", value: "1"),
            URLQueryItem(name: "autoplay", value: autoplay ? "1" : "0"),
            URLQueryItem(name: "rel", value: "0"),
        ]
        return components?.url
    }
}
