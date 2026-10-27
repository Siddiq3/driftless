# ScrollSnooze Privacy Policy — draft for review before publication

Developer: Siddiq Kolimi
Contact: siddiqkolimi.dev@gmail.com
Effective date: set when this policy is published.

ScrollSnooze helps you understand scrolling habits, set goals and configure app pauses.
This draft describes the first Android release from `main`. It must be reviewed against
the final release binary, deployed backend and service-provider configuration before use.

## Information processed on your device

If you enable Accessibility access, ScrollSnooze inspects the interface structures of
supported apps to detect short-video activity. Candidate video detection currently exists
for Instagram and YouTube. Other supported apps may provide app-minute tracking only.
Counting accuracy depends on the app version and permissions; unsupported or unvalidated
measurements are identified in the app.

Accessibility processing supports feed detection, local video counts and configured pauses.
It does not automate engagement actions such as likes, messages or purchases. Interface
text used for duplicate detection is transformed into short-lived salted fingerprints;
raw viewed-video titles, messages and screenshots are not part of account backup.

Usage Access, if enabled, supplies supported apps' foreground usage time. Local storage
also includes goals, setup answers, settings, daily activity and measurement-quality data.
Setup answers are not uploaded by the current backup flow. Debug diagnostic exports are
separate from account backup and require an explicit export/share action.

## Google sign-in and account backup

You can use local tracking as a guest. If you sign in with Google, Google's SDK handles
authentication and provides an identity token. The app uses your Google display name, or
a fallback derived from your email address, for presentation. The backend identifies the
account using Google's opaque identifier, not an email-address lookup. We do not receive
your Google password or gain access to Gmail or Google Drive from this sign-in flow.

The sign-in screen explains that signing in enables automatic backup. Account information
includes a display name/handle, timezone, saved goals, daily supported usage totals,
measurement-quality fields and randomly generated device identifiers. Backed-up private
video totals may include experimental measurements; a private total does not establish
eligibility for a competitive score. The backend also maintains account-wide usage-limit
and device-allocation records where those features apply.

Signing out stops this app session's automatic account backup. It does not by itself
remove data already stored in your account.

## Friends and challenges

Sharing with friends is a separate choice from signing in. When general sharing is enabled,
accepted friends may see eligible daily totals. Starting or accepting a scoped battle may
separately authorize sharing its aggregate score for the displayed battle window. These
choices do not authorize sharing raw viewing events or the content of videos you watch.
You can change sharing settings, stop battle-score sharing or remove a friend in the app.
Link-based ongoing War invitations are not included in this first release.

## Notifications and payments

The app can request notification permission. Where push delivery is configured, a device
push token and notification-delivery records are processed to deliver app notifications.
The first release does not sell subscriptions; implemented features do not require payment.
We do not receive payment-card details. Review the final bundled SDKs and deployed delivery
providers before publishing the final service-provider disclosures below.

## Service providers and transfers

Google provides sign-in and Google Play distribution. Account services run on Amazon Web
Services. If enabled in the deployment, push delivery also uses the configured Google/AWS
notification services. These providers may process data outside your country. We do not
sell personal information. This release does not include an advertising or behavioral
analytics integration in its application code.

## Retention and security

Local data remains on your phone until removed, subject to the recorder's local cleanup
rules. Raw local event history is normally pruned after 30 days; daily totals may remain
until reset. Cloud daily usage records have a retention window of up to 400 days, with
expiry implemented using database TTL; physical removal can follow expiry asynchronously.
Account profile, relationship and goal records remain until deleted or otherwise removed.
Operational logs are configured for limited retention; deployed backup retention and any
exceptional legal/security retention must be confirmed before final publication.

Account requests use HTTPS and authenticated account-scoped access. No service can promise
absolute security. Do not send passwords, access tokens or private viewing logs by email.

## Your choices and deletion

You can turn Accessibility and Usage Access off in Android settings. In ScrollSnooze,
Privacy & data provides account export, account deletion and local reset controls.
Account deletion removes account-associated application data through the backend deletion
workflow; if interrupted, the app can offer deletion recovery. It does not delete your
Google account. Cloud deletion and local-device reset are separate actions.

You can also request account deletion by contacting **siddiqkolimi.dev@gmail.com** with the
subject **ScrollSnooze account deletion**. We may request reasonable verification of account
ownership before taking action. Never email your password or authentication tokens.
We will explain any data retained for a necessary legal/security purpose and the applicable
retention period. Backup-copy expiry timing must be verified and specified before publication.

## Audience and updates

ScrollSnooze's intended age audience must be confirmed in the Play Console listing before
publication. Do not infer a children's offering from school/study examples. Material changes
to this policy will be reflected in its published effective date and relevant in-app notices.
For privacy questions, contact **siddiqkolimi.dev@gmail.com**.
