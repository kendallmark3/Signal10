import SwiftUI
import WebKit

/// Plays one step of the path in YouTube's embedded player, says why it was picked, and moves
/// on to the next unwatched step.
struct PlayerSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    let topic: String
    let path: [PathStep]
    @State var current: PathStep

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                YouTubePlayer(videoID: current.video.id)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    // A view, not a ShapeStyle, so the black stays out of the navigation bar.
                    .background { Color.black }
                    .id(current.video.id)
                    .accessibilityIdentifier("player")
                ScrollView {
                    details.padding(16)
                }
            }
            .navigationTitle("Step \(current.step) of \(path.count)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }

    private var next: PathStep? {
        let after = path.filter { $0.step > current.step && !app.isWatched($0.video.id, topic: topic) }
        return after.first ?? app.upNext(in: path.filter { $0.video.id != current.video.id }, topic: topic)
    }

    private var details: some View {
        let video = current.video
        let watched = app.isWatched(video.id, topic: topic)
        return VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(current.stage.uppercased()).font(.caption.weight(.bold)).foregroundStyle(Color.brand)
                Text(video.title).font(.title3.weight(.semibold))
                Text(metadata(video)).font(.subheadline).foregroundStyle(.secondary)
                if let views = video.viewsLabel {
                    Text(views).font(.caption).foregroundStyle(.secondary)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Why Signal10 picked it").font(.headline)
                    Spacer()
                    Chip(text: video.headline, tint: video.missingWords.isEmpty ? .brand : .orange)
                }
                Text(video.reason).font(.callout)
                SignalBars(signals: video.signals)
                Text("Rank #\(video.rank) · score \(video.score) · #\(video.rankByViews) by views alone")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(14)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))

            VStack(alignment: .leading, spacing: 6) {
                Text("Where it fits").font(.headline)
                Text(current.pathReason).font(.callout).foregroundStyle(.secondary)
            }

            if watched {
                if let next {
                    Button { current = next } label: {
                        Label("Next: \(next.video.title)", systemImage: "forward.fill").frame(maxWidth: .infinity).lineLimit(1)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
                Button("Mark as not watched") { app.setWatched(false, videoID: video.id, topic: topic) }
                    .frame(maxWidth: .infinity)
            } else {
                Button {
                    app.setWatched(true, videoID: video.id, topic: topic)
                    if let next { current = next } else { dismiss() }
                } label: {
                    Label(next == nil ? "Mark watched · finish path" : "Mark watched · play next",
                          systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .accessibilityIdentifier("markWatched")
            }

            Link(destination: video.url) {
                Label("Open on YouTube", systemImage: "arrow.up.right.square").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)

            Text("Some creators turn off playback outside YouTube. If the player shows a message, open the video on YouTube and come back here when you are done.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

/// The five ranking signals, labelled as in the README.
struct SignalBars: View {
    let signals: Signals

    var body: some View {
        let rows: [(String, Double)] = [
            ("Topic match", signals.relevance), ("Momentum", signals.momentum), ("Depth", signals.depth),
            ("Freshness", signals.recency), ("Channel", signals.authority),
        ]
        Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 6) {
            ForEach(rows, id: \.0) { name, value in
                GridRow {
                    Text(name).font(.caption).foregroundStyle(.secondary)
                    ProgressView(value: min(max(value, 0), 1)).tint(.brand)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(name)
                .accessibilityValue("\(Int((value * 100).rounded())) percent")
            }
        }
    }
}

/// YouTube's own embedded player (youtube-nocookie.com, as on the web page) in a web view.
/// Links inside the player open in the YouTube app or Safari rather than inside Signal10.
struct YouTubePlayer: UIViewRepresentable {
    let videoID: String

    // YouTube's embedded player requires a referrer identifying the app.
    private static let origin = URL(string: "https://\((Bundle.main.bundleIdentifier ?? "com.kendallsoft.Signal10").lowercased())")!

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.allowsPictureInPictureMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.isOpaque = false
        view.backgroundColor = .black
        view.scrollView.isScrollEnabled = false
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        if let embed = YouTubeEmbed.url(videoID: videoID) {
            view.loadHTMLString(Self.page(embed), baseURL: Self.origin)
        }
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        // Stops playback when the sheet closes.
        view.loadHTMLString("", baseURL: nil)
    }

    // The embed address is built from a validated id only; no title or other text goes in here.
    private static func page(_ embed: URL) -> String {
        """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>html,body{margin:0;height:100%;background:#000}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
        </head><body><iframe src="\(embed.absoluteString)" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>
        """
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
            if action.navigationType == .linkActivated, let url = action.request.url {
                await UIApplication.shared.open(url)
                return .cancel
            }
            return .allow
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url { UIApplication.shared.open(url) }
            return nil
        }
    }
}
