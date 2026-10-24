import Foundation

// The shapes of the server's replies. Field names match server.js and src/ exactly; a field the
// server leaves null or omits stays nil here, so nothing on screen is estimated.

struct Top10Response: Decodable, Sendable {
    let topic: String
    let suggestion: String?
    let candidatesFound: Int
    let candidatesOnTopic: Int
    let results: [Video]
    let learningPath: [PathStep]
    let reading: [Book]

    /// The learning path grouped by the server's stages, in the order each stage first appears.
    var stages: [Stage] {
        var order: [String] = []
        var byName: [String: [PathStep]] = [:]
        for step in learningPath {
            if byName[step.stage] == nil { order.append(step.stage) }
            byName[step.stage, default: []].append(step)
        }
        return order.map { Stage(name: $0, steps: byName[$0] ?? []) }
    }
}

struct Stage: Identifiable, Sendable {
    let name: String
    let steps: [PathStep]
    var id: String { name }
}

struct Signals: Decodable, Hashable, Sendable {
    let relevance: Double
    let momentum: Double
    let depth: Double
    let recency: Double
    let authority: Double
}

struct Video: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let channel: String
    let verified: Bool?
    let publishedText: String?
    let publishedDate: String?
    let durationText: String?
    let durationSeconds: Int?
    let views: Int?
    let url: URL
    let thumbnail: URL?
    let missingWords: [String]
    let signals: Signals
    let score: Int
    let rank: Int
    let rankByViews: Int
    let headline: String
    let reason: String

    /// "Apr 23, 2026" when the exact date is known, otherwise YouTube's relative text.
    var publishedLabel: String? {
        if let publishedDate, let date = Self.isoDay.date(from: publishedDate) {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
        return publishedText
    }

    var viewsLabel: String? {
        views.map { "\($0.formatted(.number.notation(.compactName))) views" }
    }

    private static let isoDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

/// A learning-path entry: the server sends the video's fields plus step, stage and pathReason.
struct PathStep: Decodable, Identifiable, Hashable, Sendable {
    let video: Video
    let step: Int
    let stage: String
    let pathReason: String

    var id: String { video.id }

    private enum CodingKeys: String, CodingKey { case step, stage, pathReason }

    init(from decoder: Decoder) throws {
        video = try Video(from: decoder)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        step = try container.decode(Int.self, forKey: .step)
        stage = try container.decode(String.self, forKey: .stage)
        pathReason = try container.decode(String.self, forKey: .pathReason)
    }
}

struct Book: Decodable, Identifiable, Hashable, Sendable {
    let number: Int
    let title: String
    let subtitle: String?
    let authors: String?
    let year: Int?
    let accessLabel: String
    let url: URL
    let cover: URL?

    var id: Int { number }
}

// MARK: - Architect View (/api/architect)

struct ArchitectResponse: Decodable, Sendable {
    let topic: String
    let view: ArchitectPlan
}

struct ArchitectPlan: Decodable, Sendable {
    let summary: String
    let sequence: [ArchitectStep]
    let prerequisites: [String]
    let skip: [ArchitectStep]
    let keyConcepts: [String]
    let architectureImplications: [String]
    let risks: [String]
    let nextStep: String
}

/// One step of the plan. The server resolves every step to its own video or book, so these
/// titles and links are Signal10's, never the model's.
struct ArchitectStep: Decodable, Hashable, Sendable {
    struct VideoRef: Decodable, Hashable, Sendable {
        let rank: Int
        let id: String
        let title: String
        let channel: String
        let durationText: String?
        let url: URL
    }

    struct BookRef: Decodable, Hashable, Sendable {
        let number: Int
        let title: String
        let authors: String?
        let year: Int?
        let accessLabel: String
        let url: URL
    }

    let video: VideoRef?
    let reading: BookRef?
    let why: String
}
