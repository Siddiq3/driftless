import ExpoModulesCore
import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit

public final class ScrollSnoozeScreenTimeModule: Module {
  private let defaults = UserDefaults.standard
  private lazy var settings = ManagedSettingsStore(named: .init("scrollsnooze"))
  private var controlsAvailable: Bool {
    #if SCROLLSNOOZE_UI_TEST
    return false
    #else
    return true
    #endif
  }
  private var picker: UIViewController?
  private var scope: String { defaults.string(forKey: "scrollsnooze.screenTime.scope") ?? "guest:ios" }
  private func key(_ name: String) -> String { "scrollsnooze.screenTime.\(scope).\(name)" }
  private var selection: FamilyActivitySelection {
    guard let data = defaults.data(forKey: key("selection")),
          let value = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else {
      return FamilyActivitySelection()
    }
    return value
  }
  private var count: Int {
    let value = selection
    return value.applicationTokens.count + value.categoryTokens.count + value.webDomainTokens.count
  }
  private func apply(_ paused: Bool) throws {
    guard controlsAvailable else {
      if paused { throw ScreenTimeError("Screen Time is disabled in this UI-testing build.") }
      defaults.set(false, forKey: key("paused"))
      return
    }
    if paused && AuthorizationCenter.shared.authorizationStatus != .approved {
      throw ScreenTimeError("Allow Screen Time access before pausing apps.")
    }
    if paused && count == 0 { throw ScreenTimeError("Choose apps before starting a pause.") }
    settings.clearAllSettings()
    if paused {
      let value = selection
      settings.shield.applications = value.applicationTokens.isEmpty ? nil : value.applicationTokens
      settings.shield.applicationCategories = value.categoryTokens.isEmpty ? nil : .specific(value.categoryTokens)
      settings.shield.webDomains = value.webDomainTokens.isEmpty ? nil : value.webDomainTokens
      settings.shield.webDomainCategories = value.categoryTokens.isEmpty ? nil : .specific(value.categoryTokens)
    }
    defaults.set(paused, forKey: key("paused"))
  }

  public func definition() -> ModuleDefinition {
    Name("ScrollSnoozeScreenTime")
    Function("controlsAvailable") { self.controlsAvailable }
    Function("isSimulator") { () -> Bool in
      #if targetEnvironment(simulator)
      return true
      #else
      return false
      #endif
    }
    Function("status") { () -> [String: Any] in
      guard self.controlsAvailable else {
        return ["authorization": "notDetermined", "selectedCount": 0, "paused": false]
      }
      let auth = AuthorizationCenter.shared.authorizationStatus
      if auth != .approved { try? self.apply(false) }
      return ["authorization": auth == .approved ? "approved" : auth == .denied ? "denied" : "notDetermined",
              "selectedCount": self.count,
              "paused": auth == .approved && self.defaults.bool(forKey: self.key("paused"))]
    }
    AsyncFunction("authorize") { (promise: Promise) in
      guard self.controlsAvailable else {
        promise.reject("SCREEN_TIME_UNAVAILABLE", "Screen Time is disabled in this UI-testing build."); return
      }
      Task { @MainActor in
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          promise.resolve(nil)
        } catch { promise.reject("SCREEN_TIME_AUTH", error.localizedDescription) }
      }
    }
    AsyncFunction("chooseApps") { (promise: Promise) in
      guard self.controlsAvailable else {
        promise.reject("SCREEN_TIME_UNAVAILABLE", "Screen Time is disabled in this UI-testing build."); return
      }
      guard AuthorizationCenter.shared.authorizationStatus == .approved else {
        promise.reject("SCREEN_TIME_AUTH", "Allow Screen Time access first."); return
      }
      guard self.picker == nil, let presenter = self.appContext?.utilities?.currentViewController(), presenter.presentedViewController == nil else {
        promise.reject("SCREEN_TIME_PICKER", "Close the current sheet and try again."); return
      }
      let originalScope = self.scope
      let view = SelectionSheet(initial: self.selection) { value in
        do {
          guard originalScope == self.scope else { throw ScreenTimeError("Account changed. Choose apps again.") }
          if let value {
            let data = try JSONEncoder().encode(value)
            self.defaults.set(data, forKey: self.key("selection"))
            try self.apply(self.defaults.bool(forKey: self.key("paused")) && self.count > 0)
          }
          self.picker?.dismiss(animated: true) { self.picker = nil; promise.resolve(nil) }
        } catch {
          self.picker?.dismiss(animated: true) { self.picker = nil; promise.reject("SCREEN_TIME_PICKER", error.localizedDescription) }
        }
      }
      let controller = UIHostingController(rootView: view)
      controller.isModalInPresentation = true
      self.picker = controller
      presenter.present(controller, animated: true)
    }.runOnQueue(.main)
    AsyncFunction("setPaused") { (paused: Bool) in try self.apply(paused) }.runOnQueue(.main)
    Function("selectScope") { (target: String) in
      if target != self.scope {
        // Sign-out/account switching immediately releases the previous account's shields.
        try? self.apply(false)
        self.defaults.set(target, forKey: "scrollsnooze.screenTime.scope")
        try? self.apply(false)
      }
    }
    Function("reset") {
      if self.controlsAvailable { self.settings.clearAllSettings() }
      for name in self.defaults.dictionaryRepresentation().keys where name.hasPrefix("scrollsnooze.screenTime.") && name != "scrollsnooze.screenTime.scope" {
        self.defaults.removeObject(forKey: name)
      }
    }
  }
}

private struct ScreenTimeError: LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}

private struct SelectionSheet: View {
  @State var selected: FamilyActivitySelection
  let finish: (FamilyActivitySelection?) -> Void
  init(initial: FamilyActivitySelection, finish: @escaping (FamilyActivitySelection?) -> Void) {
    _selected = State(initialValue: initial)
    self.finish = finish
  }
  var body: some View {
    NavigationStack {
      FamilyActivityPicker(selection: $selected)
        .navigationTitle("Choose apps")
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button("Cancel") { finish(nil) } }
          ToolbarItem(placement: .confirmationAction) { Button("Done") { finish(selected) } }
        }
    }.interactiveDismissDisabled()
  }
}
