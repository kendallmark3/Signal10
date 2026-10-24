import SwiftUI

/// Architect View, fetched only when opened: the one feature that costs a model call. The app
/// shows whatever /api/architect returns and does not know which model wrote it.
struct ArchitectSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    let topic: String
    let play: (String) -> Void

    private enum Phase { case loading, failed(String, retry: Bool), loaded(ArchitectPlan) }
    @State private var phase = Phase.loading

    var body: some View {
        NavigationStack {
            Group {
                switch phase {
                case .loading:
                    VStack(spacing: 14) {
                        ProgressView().controlSize(.large)
                        Text("Planning how to work through these videos. This can take up to a minute.")
                            .font(.callout).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }
                    .padding(40)
                case .failed(let message, let retry):
                    ContentUnavailableView {
                        Label("Architect View", systemImage: "map")
                    } description: {
                        Text(message)
                    } actions: {
                        if retry { Button("Try again") { Task { await load() } }.buttonStyle(.borderedProminent) }
                    }
                case .loaded(let plan):
                    plan_(plan)
                }
            }
            .navigationTitle("Architect View")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .task { await load() }
    }

    private func plan_(_ plan: ArchitectPlan) -> some View {
        List {
            Section { Text(plan.summary) }

            Section("Watch in this order") {
                ForEach(Array(plan.sequence.enumerated()), id: \.offset) { index, step in
                    stepRow(index + 1, step)
                }
            }

            list("Before you start", plan.prerequisites)

            if !plan.skip.isEmpty {
                Section("You can skip") {
                    ForEach(Array(plan.skip.enumerated()), id: \.offset) { _, step in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(step.video?.title ?? "").font(.subheadline.weight(.semibold))
                            Text(step.why).font(.callout).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            list("Key concepts", plan.keyConcepts)
            list("Architecture implications", plan.architectureImplications)
            list("Risks", plan.risks)

            if !plan.nextStep.isEmpty {
                Section("Next step") { Text(plan.nextStep) }
            }

            Section {
                Text("Written by an AI model from each video's title, channel, length and age. It has not watched the videos, and can be out of date for new technology. Every video it names is one of Signal10's ten.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder private func stepRow(_ number: Int, _ step: ArchitectStep) -> some View {
        let label = VStack(alignment: .leading, spacing: 4) {
            if let video = step.video {
                Text("\(number). Watch · #\(video.rank)").font(.caption.weight(.bold)).foregroundStyle(Color.brand)
                Text(video.title).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
            } else if let book = step.reading {
                Text("\(number). Read · \(book.accessLabel)").font(.caption.weight(.bold)).foregroundStyle(Color.brand)
                Text(book.title).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
            }
            Text(step.why).font(.callout).foregroundStyle(.secondary)
        }
        if let video = step.video {
            Button { play(video.id) } label: { label }
        } else if let book = step.reading {
            Link(destination: book.url) { label }
        }
    }

    @ViewBuilder private func list(_ title: String, _ items: [String]) -> some View {
        if !items.isEmpty {
            Section(title) {
                ForEach(items, id: \.self) { Text($0) }
            }
        }
    }

    private func load() async {
        phase = .loading
        do {
            phase = .loaded(try await app.client.architect(topic: topic).view)
        } catch Signal10Error.architectNotConfigured(let message) {
            phase = .failed(message, retry: false)
        } catch Signal10Error.signedOut {
            dismiss()
            app.needsSignIn = true
        } catch {
            phase = .failed(error.localizedDescription, retry: true)
        }
    }
}
