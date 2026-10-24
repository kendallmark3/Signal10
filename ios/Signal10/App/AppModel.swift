import Foundation
import Observation

/// App-wide state: the server connection, recent searches, watched videos, and whether the
/// server wants the user to sign in.
@MainActor @Observable
final class AppModel {
    let client: Signal10Client
    private(set) var recent: [String]
    /// Set when a request comes back signed out; the root view shows the sign-in sheet.
    var needsSignIn = false
    /// Bumped after each sign-in, so screens waiting on one reload.
    private(set) var sessionGeneration = 0

    private let progress: LearningProgress
    private let favoritesStore: FavoritesStore
    private let defaults: UserDefaults
    private var watchedRevision = 0
    private var favoritesRevision = 0
    // Searches already fetched this launch, so moving back and forth costs the server nothing.
    // Pull to refresh asks again.
    private var cache: [String: Top10Response] = [:]

    init(client: Signal10Client, defaults: UserDefaults = .standard) {
        self.client = client
        self.defaults = defaults
        self.progress = LearningProgress(defaults: defaults)
        self.favoritesStore = FavoritesStore(defaults: defaults)
        self.recent = RecentSearches.load(from: defaults)
    }

    func remember(_ topic: String) {
        recent = RecentSearches.add(recent, topic)
        RecentSearches.save(recent, to: defaults)
    }

    func top10(_ topic: String, refresh: Bool = false) async throws -> Top10Response {
        if !refresh, let cached = cache[Topic.key(topic)] { return cached }
        let reply = try await client.top10(topic: topic)
        cache[Topic.key(topic)] = reply
        return reply
    }

    func signIn(username: String, password: String) async throws {
        try await client.signIn(username: username, password: password)
        needsSignIn = false
        sessionGeneration += 1
    }

    func signOut() async {
        await client.signOut()
        cache = [:]
    }

    // MARK: Watched videos

    func isWatched(_ videoID: String, topic: String) -> Bool {
        _ = watchedRevision
        return progress.isWatched(videoID, topic: topic)
    }

    func setWatched(_ watched: Bool, videoID: String, topic: String) {
        progress.setWatched(watched, videoID: videoID, topic: topic)
        watchedRevision += 1
    }

    func upNext(in path: [PathStep], topic: String) -> PathStep? {
        _ = watchedRevision
        return progress.upNext(in: path, topic: topic)
    }

    func watchedCount(in path: [PathStep], topic: String) -> Int {
        path.filter { isWatched($0.video.id, topic: topic) }.count
    }

    // MARK: Favorites

    var favorites: [Favorite] {
        _ = favoritesRevision
        return favoritesStore.all
    }

    func isFavorite(_ videoID: String) -> Bool {
        _ = favoritesRevision
        return favoritesStore.isFavorite(videoID)
    }

    func toggleFavorite(_ video: Video, topic: String) {
        favoritesStore.toggle(video, topic: topic)
        favoritesRevision += 1
    }

    func removeFavorite(_ videoID: String) {
        favoritesStore.remove(videoID)
        favoritesRevision += 1
    }

    // MARK: Clearing data (Settings)

    func clearRecent() {
        RecentSearches.clear(in: defaults)
        recent = []
    }

    func clearProgress() {
        progress.clearAll()
        watchedRevision += 1
    }

    func clearFavorites() {
        favoritesStore.clear()
        favoritesRevision += 1
    }
}
