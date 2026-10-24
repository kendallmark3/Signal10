import Foundation
import Testing
@testable import Signal10

// intents/ios-settings-favorites.md

private func top10() throws -> Top10Response {
    let url = try #require(Bundle(for: FavoritesMarker.self).url(forResource: "top10-swift-concurrency", withExtension: "json", subdirectory: "Fixtures"))
    return try JSONDecoder().decode(Top10Response.self, from: Data(contentsOf: url))
}
private final class FavoritesMarker {}
private func freshDefaults() throws -> UserDefaults { try #require(UserDefaults(suiteName: "s10-\(UUID())")) }

// MARK: 1, 2, 3 — favorites

@Suite struct FavoritesTests {
    @Test func keepsOnlyServerFieldsAndTopic() throws {
        let video = try top10().results[0]
        let saved = Date(timeIntervalSince1970: 1_800_000_000)
        let favorite = Favorite(video: video, topic: "Swift concurrency", savedAt: saved)
        #expect(favorite.id == video.id)
        #expect(favorite.title == video.title)
        #expect(favorite.channel == video.channel)
        #expect(favorite.thumbnail == video.thumbnail)
        #expect(favorite.durationText == video.durationText)
        #expect(favorite.url == video.url)
        #expect(favorite.topic == "Swift concurrency")
        #expect(favorite.savedAt == saved)
        let keys = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(favorite)) as? [String: Any]).keys
        #expect(Set(keys) == ["id", "title", "channel", "thumbnail", "durationText", "url", "topic", "savedAt"])
    }

    @Test func newestFirstNoDuplicatesAndUnstar() throws {
        let results = try top10().results
        let store = FavoritesStore(defaults: try freshDefaults())
        store.toggle(results[0], topic: "Swift concurrency")
        store.toggle(results[1], topic: "Swift concurrency")
        #expect(store.all.map(\.id) == [results[1].id, results[0].id])
        #expect(store.isFavorite(results[0].id))

        store.add(results[0], topic: "Another topic")
        #expect(store.all.count == 2)

        store.toggle(results[1], topic: "Swift concurrency")
        #expect(store.all.map(\.id) == [results[0].id])
        store.remove(results[0].id)
        #expect(store.all.isEmpty)
    }

    @Test func survivesStorageAndIgnoresJunk() throws {
        let defaults = try freshDefaults()
        let video = try top10().results[2]
        FavoritesStore(defaults: defaults).toggle(video, topic: "Swift concurrency")
        #expect(FavoritesStore(defaults: defaults).all.map(\.id) == [video.id])

        defaults.set(Data("not json".utf8), forKey: FavoritesStore.storageKey)
        #expect(FavoritesStore(defaults: defaults).all.isEmpty)
        defaults.set(42, forKey: FavoritesStore.storageKey)
        #expect(FavoritesStore(defaults: defaults).all.isEmpty)
    }
}

// MARK: 4, 5 — settings

@Suite struct SettingsTests {
    @Test func defaultsAndPersistence() throws {
        let defaults = try freshDefaults()
        let settings = AppSettings(defaults: defaults)
        #expect(settings.startView == .path)
        #expect(settings.autoplay == true)

        settings.startView = .ranking
        settings.autoplay = false
        let reread = AppSettings(defaults: defaults)
        #expect(reread.startView == .ranking)
        #expect(reread.autoplay == false)
    }

    @Test func autoplaySettingReachesThePlayer() throws {
        let off = try #require(YouTubeEmbed.url(videoID: "E95agtPgaa0", autoplay: false))
        let on = try #require(YouTubeEmbed.url(videoID: "E95agtPgaa0", autoplay: true))
        let value = { (url: URL) in URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "autoplay" }?.value }
        #expect(value(off) == "0")
        #expect(value(on) == "1")
    }
}

// MARK: 6 — clearing data

@Suite struct ClearDataTests {
    @Test func eachClearTouchesOnlyItsOwnData() throws {
        let defaults = try freshDefaults()
        let video = try top10().results[0]
        let progress = LearningProgress(defaults: defaults)
        let favorites = FavoritesStore(defaults: defaults)

        func seed() {
            progress.setWatched(true, videoID: "aaaaaaaaaaa", topic: "Swift")
            progress.setWatched(true, videoID: "bbbbbbbbbbb", topic: "AWS AgentCore")
            RecentSearches.save(["Swift", "AWS AgentCore"], to: defaults)
            favorites.add(video, topic: "Swift")
        }

        seed()
        progress.clearAll()
        #expect(!progress.isWatched("aaaaaaaaaaa", topic: "Swift"))
        #expect(!progress.isWatched("bbbbbbbbbbb", topic: "AWS AgentCore"))
        #expect(RecentSearches.load(from: defaults) == ["Swift", "AWS AgentCore"])
        #expect(favorites.all.count == 1)

        seed()
        RecentSearches.clear(in: defaults)
        #expect(RecentSearches.load(from: defaults).isEmpty)
        #expect(progress.isWatched("aaaaaaaaaaa", topic: "Swift"))
        #expect(favorites.all.count == 1)

        seed()
        favorites.clear()
        #expect(favorites.all.isEmpty)
        #expect(progress.isWatched("bbbbbbbbbbb", topic: "AWS AgentCore"))
        #expect(RecentSearches.load(from: defaults) == ["Swift", "AWS AgentCore"])
    }
}

// MARK: 7, 8 — help and about

@Suite struct HelpAboutTests {
    @Test func helpUsesTheServersLabels() {
        #expect(HelpContent.signals.map(\.name) == ["Topic match", "Momentum", "Depth", "Freshness", "Channel"])
        // src/learning-path.js STAGES
        #expect(HelpContent.stages.map(\.name) == ["Foundation / overview", "Core learning", "Deeper learning", "Practical / application"])
        #expect(HelpContent.signals.allSatisfy { !$0.detail.isEmpty })
        #expect(HelpContent.stages.allSatisfy { !$0.detail.isEmpty })
    }

    @Test func aboutCarriesVersionAndCredit() {
        #expect(AppInfo.credit == "Developed by Mark Kendall at repogenic.com")
        #expect(AppInfo.creditURL == URL(string: "https://repogenic.com"))
        #expect(AppInfo.version.hasPrefix("1.0"))
    }
}
