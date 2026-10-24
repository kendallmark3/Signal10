import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @AppStorage(AppSettings.startViewKey) private var startView = StartView.path
    @AppStorage(AppSettings.autoplayKey) private var autoplay = true

    private enum Clearing: String, Identifiable {
        case recent, progress, favorites
        var id: String { rawValue }
    }
    @State private var confirming: Clearing?

    var body: some View {
        NavigationStack {
            Form {
                Section("Learning") {
                    Picker("Open results in", selection: $startView) {
                        ForEach(StartView.allCases, id: \.self) { Text($0.label) }
                    }
                    Toggle("Autoplay videos", isOn: $autoplay)
                }

                Section {
                    Button("Clear recent searches", role: .destructive) { confirming = .recent }
                        .disabled(app.recent.isEmpty)
                    Button("Clear watched progress", role: .destructive) { confirming = .progress }
                    Button("Clear favorites", role: .destructive) { confirming = .favorites }
                        .disabled(app.favorites.isEmpty)
                } header: {
                    Text("Your data")
                } footer: {
                    Text("Recent searches, watched videos and favorites are kept only on this iPhone.")
                }

                Section("Account") {
                    LabeledContent("Server", value: app.client.baseURL.host() ?? "")
                    Button("Sign out", role: .destructive) {
                        Task {
                            await app.signOut()
                            dismiss()
                        }
                    }
                }

                Section {
                    NavigationLink {
                        HelpView()
                    } label: {
                        Label("Help and how-to", systemImage: "questionmark.circle")
                    }
                    .accessibilityIdentifier("helpLink")
                    LabeledContent("Version", value: AppInfo.version)
                    Link(AppInfo.credit, destination: AppInfo.creditURL)
                } header: {
                    Text("About")
                } footer: {
                    Text("Ranked by Signal10. Videos from YouTube. Free reading from Open Library.")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .confirmationDialog(title(confirming), isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } }),
                                titleVisibility: .visible, presenting: confirming) { clearing in
                Button("Clear", role: .destructive) { clear(clearing) }
            } message: { _ in
                Text("This cannot be undone.")
            }
        }
    }

    private func title(_ clearing: Clearing?) -> String {
        switch clearing {
        case .recent: "Clear recent searches?"
        case .progress: "Clear watched progress for every topic?"
        case .favorites: "Clear all favorites?"
        case nil: ""
        }
    }

    private func clear(_ clearing: Clearing) {
        switch clearing {
        case .recent: app.clearRecent()
        case .progress: app.clearProgress()
        case .favorites: app.clearFavorites()
        }
    }
}

struct HelpView: View {
    var body: some View {
        List {
            Section("How to use Signal10") {
                step(1, "Type what you want to learn", "A topic, skill or technology. Signal10 searches YouTube three ways and keeps the ten videos most worth your time.")
                step(2, "Start here", "The first video in your learning path is the place to begin.")
                step(3, "Watch, then move on", "When you finish a video, tap Mark watched · play next.")
                step(4, "Come back any time", "Signal10 remembers what you have watched, so Up next always shows where you left off.")
                step(5, "Save the good ones", "Tap the star on a video to keep it in Favorites on the Home screen.")
            }

            Section {
                ForEach(HelpContent.signals) { entry($0) }
            } header: {
                Text("How videos are picked")
            } footer: {
                Text("Each video is scored from 0 to 100 on these five signals. Near-duplicates are removed and no channel takes more than two places. Lifetime views alone never decide the order.")
            }

            Section {
                ForEach(HelpContent.stages) { entry($0) }
            } header: {
                Text("The learning path")
            } footer: {
                Text("Stages come from words in each title, not from watching the video. Switch to Top 10 to see the plain ranking.")
            }

            Section("Architect View") {
                Text("The map button turns your ten videos into a plan: what to watch in order, what to know first, what you can skip, key concepts and risks. It is written by an AI model from each video's title, channel, length and age, and only ever names Signal10's own videos.")
            }

            Section("Tips") {
                tip("hand.tap", "Touch and hold a video to mark it watched, save it, or open it on YouTube.")
                tip("arrow.down", "Pull down on the results to search again.")
                tip("play.slash", "If a video won't play here, tap Open on YouTube, then come back to Signal10.")
                tip("character.cursor.ibeam", "If YouTube suggests a spelling, Did you mean appears above the results.")
            }
        }
        .navigationTitle("Help")
        .navigationBarTitleDisplayMode(.inline)
        .scrollIndicatorsFlash(onAppear: true)
    }

    private func step(_ number: Int, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 26, height: 26)
                .background(Color.brand, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.callout).foregroundStyle(.secondary)
            }
        }
    }

    private func entry(_ entry: HelpContent.Entry) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(entry.name).font(.subheadline.weight(.semibold))
            Text(entry.detail).font(.callout).foregroundStyle(.secondary)
        }
    }

    private func tip(_ icon: String, _ text: String) -> some View {
        Label { Text(text).font(.callout) } icon: { Image(systemName: icon).foregroundStyle(Color.brand) }
    }
}
