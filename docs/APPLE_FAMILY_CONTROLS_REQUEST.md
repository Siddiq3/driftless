# Apple Family Controls Distribution Request — Draft

Form: https://developer.apple.com/contact/request/family-controls-distribution
Submit **one request per bundle ID** (Apple requires the same request for the app and each Screen Time extension — see PLATFORM_CAPABILITIES S3).

## Bundle IDs (proposed — confirm before submitting)
| Target | Bundle ID |
|---|---|
| App | `com.siddiqkolimi.driftless` |
| DeviceActivityMonitor extension | `com.siddiqkolimi.driftless.monitor` |
| DeviceActivityReport extension | `com.siddiqkolimi.driftless.report` |
| ShieldConfiguration extension | `com.siddiqkolimi.driftless.shieldconfig` |
| ShieldAction extension | `com.siddiqkolimi.driftless.shieldaction` |

Register these App IDs (with Family Controls capability and a shared App Group `group.com.siddiqkolimi.driftless`) in Certificates, Identifiers & Profiles first.

## Description of use (paste into the form)

Driftless is a self-directed digital wellbeing app for adults who want to reduce time spent in short-video apps on their own iPhone. It uses Family Controls with **individual authorization** only (the device owner authorizes themselves); there is no parent/child or remote monitoring of another person.

How each framework is used:
- **FamilyControls:** request individual authorization; the user selects apps and categories to manage with FamilyActivityPicker. The app only stores the opaque selection in its App Group to apply the user's own limits.
- **DeviceActivity:** the user sets a daily time limit and optional schedules (e.g. focus hours, bedtime). The DeviceActivityMonitor extension receives schedule and threshold callbacks to apply or remove restrictions. A DeviceActivityReport extension shows the user their own time in the selected apps on-device.
- **ManagedSettings:** when the user's own limit is reached or a schedule begins, selected apps are shielded. The ShieldConfiguration and ShieldAction extensions show a calm, branded reminder screen with options to close the app.

Data handling:
- Screen Time activity data is displayed only inside the DeviceActivityReport extension and is **not exported, transmitted to a server, sold, or shared** with other users or third parties.
- No advertising, analytics SDKs, or data brokers.
- The user can remove restrictions at any time by revoking authorization in Settings, and restrictions are cleared if the app is deleted.

Account/backend: optional account for goals and app settings backup only; no Screen Time data is included.

## Before submitting — checklist
- [ ] Apple Developer Program membership active (Account Holder submits).
- [ ] Bundle IDs above confirmed (changing them later requires a new request).
- [ ] Privacy policy URL live (needed for App Review later; recommended now).
- [ ] Text above reviewed — it commits to D-009 (no Screen Time data leaves the device). If you plan iOS social features using Screen Time data, do **not** submit until that is resolved.
