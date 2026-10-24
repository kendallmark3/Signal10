import SwiftUI

struct ResultsView: View {
    @Environment(AppModel.self) private var app
    @State var topic: String

    private enum Phase { case loading, failed(String), loaded(Top10Response) }
    private enum Mode: String, CaseIterable { case path = "Learning path", ranking = "Top 10" }

    @State private var phase = Phase.loading
    @State private var mode = Mode.path
    @State private var playing: PathStep?
    @State private var showArchitect = false

    var body: some View {
        content
            .navigationTitle(topic)
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                if case .loaded = phase {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showArchitect = true } label: {
                            Label("Architect View", systemImage: "map")
                        }
                    }
                }
            }
            .task(id: "\(topic)#\(app.sessionGeneration)") { await load() }
            .sheet(item: $playing) { step in
                if case .loaded(let reply) = phase {
                    PlayerSheet(topic: reply.topic, path: reply.learningPath, current: step)
                }
            }
            .sheet(isPresented: $showArchitect) {
                if case .loaded(let reply) = phase {
                    ArchitectSheet(topic: reply.topic) { videoID in
                        showArchitect = false
                        playing = reply.learningPath.first { $0.video.id == videoID }
                    }
                }
            }
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .loading:
            VStack(spacing: 14) {
                ProgressView().controlSize(.large)
                Text("Searching YouTube three ways and ranking what comes back…")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(40)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            ContentUnavailableView {
                Label("No path yet", systemImage: "wifi.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { Task { await load() } }.buttonStyle(.borderedProminent)
            }
        case .loaded(let reply):
            loaded(reply)
        }
    }

    private func loaded(_ reply: Top10Response) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                summary(reply)

                if let suggestion = reply.suggestion {
                    Button {
                        app.remember(suggestion)
                        topic = suggestion
                    } label: {
                        (Text("Did you mean ") + Text(suggestion).bold() + Text("?"))
                            .font(.callout)
                    }
                }

                if reply.results.isEmpty {
                    ContentUnavailableView("No on-topic videos", systemImage: "magnifyingglass",
                                           description: Text("Try fewer or more common words."))
                } else {
                    upNext(reply)

                    Picker("View", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) }
                    }
                    .pickerStyle(.segmented)

                    switch mode {
                    case .path: path(reply)
                    case .ranking: ranking(reply)
                    }
                }

                if !reply.reading.isEmpty { ReadingSection(books: reply.reading) }

                Text("Ranked by Signal10. Videos and thumbnails from YouTube.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
            .accessibilityIdentifier("results")
        }
        .scrollIndicators(.visible)
        .scrollIndicatorsFlash(onAppear: true)
        .refreshable { await load(refresh: true) }
    }

    private func summary(_ reply: Top10Response) -> some View {
        let watched = app.watchedCount(in: reply.learningPath, topic: reply.topic)
        let total = reply.learningPath.count
        return VStack(alignment: .leading, spacing: 8) {
            Text("\(reply.results.count) videos, picked from \(reply.candidatesOnTopic) on-topic candidates")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if total > 0 {
                ProgressView(value: Double(watched), total: Double(total))
                Text(watched == 0 ? "Not started" : "\(watched) of \(total) watched")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder private func upNext(_ reply: Top10Response) -> some View {
        if let next = app.upNext(in: reply.learningPath, topic: reply.topic) {
            Button { playing = next } label: {
                // Compact, so the path itself starts on the first screen.
                HStack(alignment: .top, spacing: 12) {
                    Thumbnail(url: next.video.thumbnail, duration: next.video.durationText)
                        .frame(width: 140)
                        .overlay {
                            Image(systemName: "play.circle.fill")
                                .font(.system(size: 34))
                                .symbolRenderingMode(.palette)
                                .foregroundStyle(.white, .black.opacity(0.45))
                        }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(next.step == 1 && app.watchedCount(in: reply.learningPath, topic: reply.topic) == 0
                             ? "START HERE" : "UP NEXT · STEP \(next.step) OF \(reply.learningPath.count)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Color.brand)
                        Text(next.video.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                        Text(next.video.channel)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.brand.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.brand.opacity(0.25)))
            }
            .buttonStyle(.plain)
            .accessibilityHint("Plays the next video in your path")
            .accessibilityIdentifier("upNext")
        } else {
            HStack(spacing: 12) {
                Image(systemName: "checkmark.seal.fill").font(.largeTitle).foregroundStyle(Color.brand)
                VStack(alignment: .leading) {
                    Text("Path complete").font(.headline)
                    Text("You have watched all \(reply.learningPath.count) videos.").font(.subheadline).foregroundStyle(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private func path(_ reply: Top10Response) -> some View {
        ForEach(reply.stages) { stage in
            VStack(alignment: .leading, spacing: 14) {
                Text(stage.name.uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
                ForEach(stage.steps) { step in
                    VideoRow(video: step.video, badge: .step(step.step), watched: app.isWatched(step.video.id, topic: reply.topic),
                             detail: step.video.reason) { playing = step }
                        .contextMenu { watchToggle(step.video, topic: reply.topic) }
                }
            }
        }
    }

    private func ranking(_ reply: Top10Response) -> some View {
        ForEach(reply.results) { video in
            VideoRow(video: video, badge: .rank(video.rank), watched: app.isWatched(video.id, topic: reply.topic),
                     detail: "\(video.reason) Score \(video.score) · #\(video.rankByViews) by views alone.") {
                playing = reply.learningPath.first { $0.video.id == video.id }
            }
            .contextMenu { watchToggle(video, topic: reply.topic) }
        }
    }

    @ViewBuilder private func watchToggle(_ video: Video, topic: String) -> some View {
        let watched = app.isWatched(video.id, topic: topic)
        Button(watched ? "Mark as not watched" : "Mark as watched", systemImage: watched ? "circle" : "checkmark.circle") {
            app.setWatched(!watched, videoID: video.id, topic: topic)
        }
        Link(destination: video.url) { Label("Open on YouTube", systemImage: "arrow.up.right.square") }
    }

    private func load(refresh: Bool = false) async {
        // A refresh keeps the current list on screen until the new one arrives.
        if !refresh { phase = .loading }
        do {
            phase = .loaded(try await app.top10(topic, refresh: refresh))
        } catch Signal10Error.signedOut {
            phase = .failed(Signal10Error.signedOut.localizedDescription)
            app.needsSignIn = true
        } catch {
            if case .loaded = phase, refresh { return }
            phase = .failed(error.localizedDescription)
        }
    }
}

func metadata(_ video: Video) -> String {
    [video.channel + (video.verified == true ? " ✓" : ""), video.durationText, video.publishedLabel]
        .compactMap { $0 }
        .joined(separator: " · ")
}

struct VideoRow: View {
    enum Badge { case step(Int), rank(Int) }

    let video: Video
    let badge: Badge
    let watched: Bool
    let detail: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                badgeView
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .top, spacing: 10) {
                        Thumbnail(url: video.thumbnail, duration: video.durationText)
                            .frame(width: 120)
                            .opacity(watched ? 0.55 : 1)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(video.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                                .lineLimit(3)
                                .multilineTextAlignment(.leading)
                            Text(video.channel + (video.verified == true ? " ✓" : ""))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                    HStack(spacing: 6) {
                        Chip(text: video.headline, tint: video.missingWords.isEmpty ? .brand : .orange)
                        if let date = video.publishedLabel {
                            Text(date).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityValue(watched ? "Watched" : "")
        .accessibilityIdentifier("video-\(video.id)")
    }

    @ViewBuilder private var badgeView: some View {
        switch badge {
        case .step(let step):
            ZStack {
                Circle().fill(watched ? Color.brand : Color(.secondarySystemBackground))
                if watched {
                    Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(.white)
                } else {
                    Text("\(step)").font(.subheadline.weight(.bold)).foregroundStyle(.primary)
                }
            }
            .frame(width: 30, height: 30)
        case .rank(let rank):
            Text("\(rank)")
                .font(.title2.weight(.heavy).monospacedDigit())
                .foregroundStyle(watched ? Color.secondary : Color.brand)
                .frame(width: 30)
        }
    }
}

struct ReadingSection: View {
    let books: [Book]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("FREE READING").font(.caption.weight(.bold)).foregroundStyle(.secondary)
            ForEach(books) { book in
                Link(destination: book.url) {
                    HStack(alignment: .top, spacing: 12) {
                        AsyncImage(url: book.cover) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Image(systemName: "book.closed").foregroundStyle(.secondary)
                        }
                        .frame(width: 44, height: 64)
                        .background(Color.secondary.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(book.subtitle.map { "\(book.title): \($0)" } ?? book.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                            Text([book.authors, book.year.map(String.init)].compactMap { $0 }.joined(separator: " · "))
                                .font(.caption).foregroundStyle(.secondary)
                            Text(book.accessLabel).font(.caption).foregroundStyle(Color.brand)
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
            Text("From Open Library.").font(.caption2).foregroundStyle(.secondary)
        }
    }
}
