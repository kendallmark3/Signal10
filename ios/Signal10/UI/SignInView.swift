import SwiftUI

/// The server's shared sign-in. The password goes to the server once and is not stored; the
/// server's seven-day session cookie is kept by the system cookie store.
struct SignInView: View {
    @Environment(AppModel.self) private var app
    @State private var username = ""
    @State private var password = ""
    @State private var message: String?
    @State private var busy = false
    @FocusState private var field: Field?
    private enum Field { case username, password }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Wordmark(height: 44).frame(maxWidth: .infinity).listRowBackground(Color.clear)
                }
                Section {
                    TextField("Username", text: $username)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($field, equals: .username)
                        .submitLabel(.next)
                        .onSubmit { field = .password }
                        .accessibilityIdentifier("username")
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .focused($field, equals: .password)
                        .submitLabel(.go)
                        .onSubmit(signIn)
                        .accessibilityIdentifier("password")
                } footer: {
                    if let message {
                        Text(message).foregroundStyle(.red)
                    } else {
                        Text("Signal10 is private for now. Use the username and password set on the server (\(app.client.baseURL.host() ?? "")).")
                    }
                }
                Section {
                    Button(action: signIn) {
                        HStack {
                            Spacer()
                            if busy { ProgressView() } else { Text("Sign in").bold() }
                            Spacer()
                        }
                    }
                    .disabled(username.isEmpty || password.isEmpty || busy)
                    .accessibilityIdentifier("signInButton")
                }
            }
            .navigationTitle("Sign in")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { field = .username }
        }
        .interactiveDismissDisabled(busy)
    }

    private func signIn() {
        guard !username.isEmpty, !password.isEmpty, !busy else { return }
        busy = true
        message = nil
        Task {
            defer { busy = false }
            do {
                try await app.signIn(username: username, password: password)
                password = ""
            } catch {
                message = error.localizedDescription
            }
        }
    }
}
