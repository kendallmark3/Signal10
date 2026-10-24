import Foundation

/// A saved video. Only the fields the server sent, plus where and when it was saved.
struct Favorite: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let channel: String
    let thumbnail: URL?
    let durationText: String?
    let url: URL
    let topic: String
    let savedAt: Date

    init(video: Video, topic: String, savedAt: Date = .now) {
        id = video.id
        title = video.title
        channel = video.channel
        thumbnail = video.thumbnail
        durationText = video.durationText
        url = video.url
        self.topic = Topic.tidy(topic)
        self.savedAt = savedAt
    }
}

/// Favorites on this device, newest first, one entry per video.
final class FavoritesStore: @unchecked Sendable {
    static let storageKey = "signal10.favorites"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // Storage can hold anything; whatever is wrong, the answer is an empty list.
    var all: [Favorite] {
        guard let data = defaults.data(forKey: Self.storageKey),
              let saved = try? JSONDecoder().decode([Favorite].self, from: data) else { return [] }
        return saved
    }

    func isFavorite(_ videoID: String) -> Bool {
        all.contains { $0.id == videoID }
    }

    func add(_ video: Video, topic: String) {
        guard !isFavorite(video.id) else { return }
        save([Favorite(video: video, topic: topic)] + all)
    }

    func remove(_ videoID: String) {
        save(all.filter { $0.id != videoID })
    }

    func toggle(_ video: Video, topic: String) {
        if isFavorite(video.id) { remove(video.id) } else { add(video, topic: topic) }
    }

    func clear() {
        defaults.removeObject(forKey: Self.storageKey)
    }

    private func save(_ list: [Favorite]) {
        defaults.set(try? JSONEncoder().encode(list), forKey: Self.storageKey)
    }
}

enum StartView: String, CaseIterable, Sendable {
    case path, ranking

    var label: String {
        switch self {
        case .path: "Learning path"
        case .ranking: "Top 10"
        }
    }
}

/// The app's settings. The keys are shared with the views' @AppStorage.
final class AppSettings: @unchecked Sendable {
    static let startViewKey = "signal10.startView"
    static let autoplayKey = "signal10.autoplay"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var startView: StartView {
        get { defaults.string(forKey: Self.startViewKey).flatMap(StartView.init(rawValue:)) ?? .path }
        set { defaults.set(newValue.rawValue, forKey: Self.startViewKey) }
    }

    var autoplay: Bool {
        get { defaults.object(forKey: Self.autoplayKey) as? Bool ?? true }
        set { defaults.set(newValue, forKey: Self.autoplayKey) }
    }
}

enum AppInfo {
    static let credit = "Developed by Mark Kendall at repogenic.com"
    static let creditURL = URL(string: "https://repogenic.com")!

    static var version: String {
        let info = Bundle(for: FavoritesStore.self).infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }
}

/// The Help screen's explanations. Names match the server's labels: the signals in README.md and
/// the stages in src/learning-path.js.
enum HelpContent {
    struct Entry: Identifiable, Sendable {
        let name: String
        let detail: String
        var id: String { name }
    }

    static let signals = [
        Entry(name: "Topic match", detail: "How many of your topic's words appear in the title and channel, plus YouTube's own search position. A video missing a word is marked Partial match."),
        Entry(name: "Momentum", detail: "Views per day since posting, compared with the other candidates. Lifetime views are never scored directly."),
        Entry(name: "Depth", detail: "Length, favoring videos of 20 to 90 minutes."),
        Entry(name: "Freshness", detail: "Age. A video's freshness halves in value each year."),
        Entry(name: "Channel", detail: "A verified badge, and whether the channel has several videos on the topic."),
    ]

    static let stages = [
        Entry(name: "Foundation / overview", detail: "Titles that say beginner, basics, introduction or overview. Start here."),
        Entry(name: "Core learning", detail: "Titles with no level or hands-on wording. Shorter videos come first."),
        Entry(name: "Deeper learning", detail: "Titles that say advanced, deep dive or internals."),
        Entry(name: "Practical / application", detail: "Titles that say tutorial, build, project or hands-on. Apply what you learned."),
    ]
}
