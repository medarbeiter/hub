# Graph Report - medarbeiter_timetracker  (2026-08-15)

## Corpus Check
- Large corpus: 250 files · ~821,276 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1658 nodes · 5433 edges · 110 communities (92 shown, 18 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 122 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Absence Review Actions
- Audited Server Actions
- Calendar Absence Pages
- Month Grid System
- Time Lane Clock UI
- TOTP Access Codes
- Route Loading States
- Team Shell Summaries
- Receipt Storage API
- TypeScript Environment Refs
- Notification Delivery
- My Time Account
- Database Schema Migrations
- Management PWA Pages
- Review Audit Lists
- User Management State
- Employee Account Actions
- Trip Editor Allowances
- Clock Stamping State
- Profile Google Connection
- OAuth Token Server
- Period Navigation
- Login Google Entry
- Onboarding Auth Flow
- Coolify Container Deployment
- Settings Mail Ledger
- Time Segment Editing
- Trip List Expansion
- Receipt Trip Detail
- Google Identity Services
- Authentication Form State
- Root Layout Providers
- Attention Issue Detection
- Audit Log Chain
- German Public Holidays
- Reports and Print
- Access Code UI
- OAuth App Administration
- Mail Unsubscribe Content
- Runtime Dependencies
- Sidebar Navigation
- Google OAuth Callback
- Connected Apps Mail
- Audit Filters Vocabulary
- Calendar Surface Design
- Avatar Personal Settings
- Build Dependencies
- Google Calendar Sync
- OAuth Authorization Consent
- Attention Toast Navigation
- Email Theme Contrast
- CSV Export Audit
- Package Scripts Metadata
- Fragment Merge Script
- Icon Vocabulary Navigation
- Settings Form
- Accounting Owl Avatar
- Product Audit Principles
- Notice Messaging
- Animal Avatar Set
- Account Octopus Avatar
- QR Code Reader
- Hospital Penguin Avatar
- Travel Expense Data
- Deployment Bootstrap
- Marketing Peacock Avatar
- Executive Lion Avatar
- Nursing Capybara Avatar
- Support Parrot Avatar
- Date Axis
- Business Eagle Avatar
- Absence Domain Rules
- Travel Expense Rules
- OAuth Security Model
- Database Test Setup
- Sales Fox Avatar
- CEO Panther Avatar
- PWA Icon 192
- PWA Icon 512
- Public Brand Logo
- Health Check API
- Source Brand Logo
- Square Brand Logo
- Apple Touch Icon
- Public Logo Mark
- Gold Color Discipline
- Legacy Time Redirect
- Setup Page
- Runtime Engine Versions
- Badge Theme Variants
- Audit Visibility Scope
- OAuth Session Tokens
- Rights Authorization
- Astryx Core Dependency
- Contrast Gold Borders
- HeroUI Styles Dependency
- Attention Segment Types
- Standalone Next Config
- React Icons Dependency
- PostCSS Configuration
- Serena Project Config
- Client Server Boundary
- Notice Gateway
- TOTP Secret Boundary

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 168 edges
2. `hatRecht()` - 72 edges
3. `requireRecht()` - 69 edges
4. `Sinnbild` - 61 edges
5. `fmtDuration()` - 59 edges
6. `monthOf()` - 58 edges
7. `protokolliere()` - 57 edges
8. `todayISO()` - 48 edges
9. `fmtDate()` - 45 edges
10. `addDays()` - 41 edges

## Surprising Connections (you probably didn't know these)
- `PasswortSchritt()` --indirect_call--> `eigenesPasswortAendernAction()`  [INFERRED]
  components/new-ui/auth-flow.tsx → app/actions.ts
- `GoogleSchritt()` --indirect_call--> `googleOauthMockVerbindenAction()`  [INFERRED]
  components/new-ui/auth-flow.tsx → app/actions.ts
- `Google Absence Reconciliation` --semantically_similar_to--> `day_types Projection`  [INFERRED] [semantically similar]
  CLAUDE.md → .impeccable/surfaces/abwesenheit.md
- `Spesen sind kein Gold` --semantically_similar_to--> `Gold-Is-Work Rule`  [INFERRED] [semantically similar]
  .impeccable/surfaces/spesen.md → DESIGN.md
- `Authoritative Rights Snapshot` --semantically_similar_to--> `Named-Rights Authorization`  [INFERRED] [semantically similar]
  ANBINDUNG.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Month-Shaped Surface Family** — _impeccable_surfaces_monatsgitter_monatsgitter, _impeccable_surfaces_abwesenheit_absence_span_model, _impeccable_surfaces_spesen_self_calculating_trip, _impeccable_surfaces_protokoll_activity_band [EXTRACTED 1.00]
- **OAuth Client Login Flow** — anbindung_oauth_authorization_code_flow, anbindung_state_csrf_binding, anbindung_single_use_code_replay_protection, anbindung_opaque_access_tokens, anbindung_app_owned_session [EXTRACTED 1.00]
- **Coolify Deployment Contract** — docker_compose_hub_service, docker_compose_required_deployment_environment, docker_compose_medarbeiter_data_volume, docker_compose_internal_healthcheck, docs_superpowers_specs_2026_08_14_coolify_docker_design_coolify_managed_traefik [EXTRACTED 1.00]
- **Sales Acquisition Workflow** — public_generated_avatars_01_vertrieb_akquise_fuchs_anthropomorphic_fox_salesperson, public_generated_avatars_01_vertrieb_akquise_fuchs_telephone_outreach, public_generated_avatars_01_vertrieb_akquise_fuchs_prospect_targeting, public_generated_avatars_01_vertrieb_akquise_fuchs_sales_documentation [INFERRED 0.85]
- **Executive Persona Composition** — public_generated_avatars_04_mercedes_amg_c_eo_panther_anthropomorphic_panther_executive, public_generated_avatars_04_mercedes_amg_c_eo_panther_mercedes_amg_sports_car, public_generated_avatars_04_mercedes_amg_c_eo_panther_executive_document_organizer, public_generated_avatars_04_mercedes_amg_c_eo_panther_chief_executive_officer_role [INFERRED 0.85]
- **Mobile Nursing Service Persona** — public_generated_avatars_06_pflegedienst_capybara_anthropomorphic_capybara_caregiver, public_generated_avatars_06_pflegedienst_capybara_nursing_service_role, public_generated_avatars_06_pflegedienst_capybara_patient_documentation_clipboard, public_generated_avatars_06_pflegedienst_capybara_mobile_care_medical_bag [INFERRED 0.85]
- **Cheerful Calling Avatar Composition** — public_generated_avatars_08_headset_calling_papagei_grinning_parrot, public_generated_avatars_08_headset_calling_papagei_call_center_headset, public_generated_avatars_08_headset_calling_papagei_thumbs_up_gesture, public_generated_avatars_08_headset_calling_papagei_coffee_mug [INFERRED 0.85]
- **Executive Oversight Metaphor** — public_generated_avatars_09_adler_anthropomorphic_bald_eagle_professional, public_generated_avatars_09_adler_binocular_observation, public_generated_avatars_09_adler_business_briefcase, public_generated_avatars_09_adler_elevated_ladder_viewpoint, public_generated_avatars_09_adler_strategic_oversight [INFERRED 0.85]
- **MedArbeiter Icon Brand Composition** — public_icon_512_gold_heart_mark, public_icon_512_ekg_pulse_line, public_icon_512_upward_arrow [EXTRACTED 1.00]
- **MedArbeiter Brand Lockup** — public_logo_medarbeiter_wordmark, public_logo_gold_heart_symbol, public_logo_heartbeat_ecg_trace [EXTRACTED 1.00]

## Communities (110 total, 18 thin omitted)

### Community 0 - "Absence Review Actions"
Cohesion: 0.05
Nodes (93): abwesenheitInputFromForm(), abwesenheitSaveAction(), auUploadAction(), meldeSpanne(), GET(), AbwesenheitPruefenPage(), dynamic, FILTER (+85 more)

### Community 1 - "Audited Server Actions"
Cohesion: 0.07
Nodes (65): abwesenheitDeleteAction(), abwesenheitEinreichenAction(), abwesenheitGenehmigenAction(), abwesenheitVorgang(), abwesenheitZurueckweisenAction(), abwesenheitZurueckziehenAction(), belegAddAction(), belegDeleteAction() (+57 more)

### Community 2 - "Calendar Absence Pages"
Cohesion: 0.10
Nodes (42): AbwesenheitPage(), dynamic, letzterTag(), PageProps, dynamic, KalenderPage(), PageProps, csvAdresse() (+34 more)

### Community 3 - "Month Grid System"
Cohesion: 0.10
Nodes (38): AbwesenheitsGitter(), AbwesenheitsJahr(), GitterMarke(), GitterMehr(), GitterWahl, GitterZelle, Monatsgitter(), MonatsgitterProps (+30 more)

### Community 4 - "Time Lane Clock UI"
Cohesion: 0.08
Nodes (38): BahnenStapel(), BahnenStapelProps, KURZ, StapelGruppe, StapelTag, ClockBar(), REMINDER_MIN, StampAction (+30 more)

### Community 5 - "TOTP Access Codes"
Cohesion: 0.10
Nodes (41): zugangEingabeAusForm(), zugangscodeAendernAction(), zugangscodeAnlegenAction(), zugangscodeLoeschenAction(), RFC-4226, RFC-4648, TotpKonto, base32Dekodieren() (+33 more)

### Community 6 - "Route Loading States"
Cohesion: 0.09
Nodes (9): BahnenGeruest(), FormularGeruest(), GitterGeruest(), KontextGeruest(), LadeBlatt(), LadeRahmen(), LadeRahmenProps, TafelGeruest() (+1 more)

### Community 7 - "Team Shell Summaries"
Cohesion: 0.13
Nodes (34): AbschlussPage(), AppLayout(), TeamPage(), TeamMemberPage(), SprungmarkeDeutsch(), offeneAntraegeImMonat(), excusedDays(), monthOf() (+26 more)

### Community 8 - "Receipt Storage API"
Cohesion: 0.15
Nodes (36): GET(), BelegArt, getDb(), addBeleg(), BELEG_MAX_BYTES, BELEG_TYPEN, belegById(), belegDateiPfad() (+28 more)

### Community 9 - "TypeScript Environment Refs"
Cohesion: 0.06
Nodes (33): bun, dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+25 more)

### Community 10 - "Notification Delivery"
Cohesion: 0.13
Nodes (31): ausserHausLabel(), AbschlussAngaben, anKreis(), anPerson(), anrede(), empfaengerMitRecht(), EntscheidungAngaben, inhaltAbwesenheitEingereicht() (+23 more)

### Community 11 - "My Time Account"
Cohesion: 0.15
Nodes (24): dynamic, MeineZeitPage(), PageProps, dynamic, PageProps, TeamKontoPage(), dynamic, PageProps (+16 more)

### Community 12 - "Database Schema Migrations"
Cohesion: 0.07
Nodes (9): DayTypeRow, Migration, migration7Abwesenheiten(), MIGRATIONS, MonthLock, RFC-6238, RFC-6749, uebernehmeTagesartenInSpannen() (+1 more)

### Community 13 - "Management PWA Pages"
Cohesion: 0.10
Nodes (21): dynamic, PageProps, dynamic, PageProps, AppHinweis(), InstallEreignis, Weg, HeuteDeckung() (+13 more)

### Community 14 - "Review Audit Lists"
Cohesion: 0.10
Nodes (21): dynamic, FILTER, PageProps, StatusLeiste(), ProtokollListeProps, ProtokollZeile, AlleGenehmigenButton(), PruefListe() (+13 more)

### Community 15 - "User Management State"
Cohesion: 0.13
Nodes (23): UserActionState, AppNavProps, Kontozeile(), INITIAL, LAND_OPTIONS, ManagedUser, ROLLEN_OPTIONS, UserManagerProps (+15 more)

### Community 16 - "Employee Account Actions"
Cohesion: 0.16
Nodes (24): userCreateAction(), userInputFromForm(), userResetPasswordAction(), userUpdateAction(), userWerte(), dynamic, MitarbeiterPage(), UserManager() (+16 more)

### Community 17 - "Trip Editor Allowances"
Cohesion: 0.14
Nodes (20): INITIAL, ReiseEditorProps, ReiseEntwurf, TAGART_SINN, TafelDialog(), berechneSpesen(), eintaegigerTag(), MAX_REISETAGE (+12 more)

### Community 18 - "Clock Stamping State"
Cohesion: 0.17
Nodes (21): stampAction(), undoStampAction(), ClockContext, ClockProvider(), ClockProviderProps, ClockValue, deriveState(), CAP_MIN (+13 more)

### Community 19 - "Profile Google Connection"
Cohesion: 0.18
Nodes (19): dynamic, ProfilPage(), GoogleVerbindung(), INITIAL, ProfilDaten(), istAvatar(), Empfaenger, MailArt (+11 more)

### Community 20 - "OAuth Token Server"
Cohesion: 0.19
Nodes (19): POST(), RFC-6749, GET(), ClientZeile, codeAusstellen(), codeEinloesen(), geheimnisErzeugen(), OauthClient (+11 more)

### Community 21 - "Period Navigation"
Cohesion: 0.14
Nodes (17): BereichsLeisteProps, Bewegungen, MonatJahrLeiste(), MonatJahrLeisteProps, MonatLeiste(), WechselArt, zoomArt(), WECHSEL_ARTEN (+9 more)

### Community 22 - "Login Google Entry"
Cohesion: 0.19
Nodes (17): loginAction(), POST(), dynamic, LoginPage(), metadata, dynamic, GOOGLE_HINWEISE, metadata (+9 more)

### Community 23 - "Onboarding Auth Flow"
Cohesion: 0.10
Nodes (14): onboardingCompleteAction(), ArbeitsplatzSchritt(), ANSICHTEN, ArbeitsplatzSchritt(), Einrichtung(), GoogleSchritt(), LOGIN_INITIAL, nachObenRollen() (+6 more)

### Community 24 - "Coolify Container Deployment"
Cohesion: 0.10
Nodes (21): Append-Only Database Migrations, Bun-Only Runtime, hub Compose Service, Internal Bun Healthcheck, medarbeiter-data Volume, Required Deployment Environment, Bootstrap Implementation Task, Compose Contract Task (+13 more)

### Community 25 - "Settings Mail Ledger"
Cohesion: 0.23
Nodes (16): einstellungenWerte(), dynamic, EinstellungenPage(), SCHEMA_VERSION, letzterVersand(), mailKonfiguriert(), absenderAdresse(), autoCloseCutoffMin() (+8 more)

### Community 26 - "Time Segment Editing"
Cohesion: 0.24
Nodes (17): segmentConfirmAction(), segmentDeleteAction(), segmentResizeAction(), segmentSaveAction(), segmentWerte(), AddEntryButton(), BelegListe(), BelegListeProps (+9 more)

### Community 27 - "Trip List Expansion"
Cohesion: 0.18
Nodes (18): Ausklapp(), ReiseEditor(), ReiseAnsicht, STATUS_VARIANT, ReisenGitterProps, JahresMonat, JahresStreifen(), ReisenStapel() (+10 more)

### Community 28 - "Receipt Trip Detail"
Cohesion: 0.19
Nodes (17): ARTEN, BelegDialog(), BelegDialogProps, WahlAnzeige(), BelegAnsicht, ReiseTafel(), ReiseTagAnsicht, fmtDateRange() (+9 more)

### Community 29 - "Google Identity Services"
Cohesion: 0.16
Nodes (12): CodeAntwort, CredentialAntwort, emailAusIdToken(), GSI_SRC, mitGis(), Window, GoogleAnmeldung(), GoogleKnopf() (+4 more)

### Community 30 - "Authentication Form State"
Cohesion: 0.13
Nodes (15): ActionState, AppAnbindungState, LoginState, PasswortState, bewegungReduziert(), Einrichtung(), GoogleOauthSchritt(), LOGIN_INITIAL (+7 more)

### Community 31 - "Root Layout Providers"
Cohesion: 0.14
Nodes (11): figtree, metadata, poppins, viewport, Providers(), IntlDeutschImBrowser(), iconProps, neutralIconRegistry (+3 more)

### Community 32 - "Attention Issue Detection"
Cohesion: 0.17
Nodes (15): attentionIssues(), correctionQueue(), dayIssues(), IssueKind, NEEDS_CORRECTION, PRIORITY, ScanOptions, sortIssues() (+7 more)

### Community 33 - "Audit Log Chain"
Cohesion: 0.14
Nodes (19): ProtokollRow, ProtokollAktion, ProtokollBereich, Bedingungen, beschreibeAbwesenheit(), beschreibeBeleg(), Gegenstand, jetztStempel() (+11 more)

### Community 34 - "German Public Holidays"
Cohesion: 0.17
Nodes (16): ALL, ALL_BUNDESLAENDER, Bundesland, bussUndBettag(), easterSunday(), holidayName(), HolidayRule, holidaysForYear() (+8 more)

### Community 35 - "Reports and Print"
Cohesion: 0.16
Nodes (15): BerichtePage(), dynamic, PageProps, DruckPage(), dynamic, PageProps, PrintToolbar(), SaldoPoint (+7 more)

### Community 36 - "Access Code UI"
Cohesion: 0.15
Nodes (15): dynamic, PageProps, DienstZeichen(), markeFuer(), MARKEN, GRUPPEN, gruppiert(), INITIAL (+7 more)

### Community 37 - "OAuth App Administration"
Cohesion: 0.18
Nodes (16): appAendernAction(), appAktivAction(), appAnlegenAction(), appSecretErneuernAction(), redirectUrisAusForm(), AENDERN_INITIAL, ANLEGEN_INITIAL, AppAnbindungenTafel() (+8 more)

### Community 38 - "Mail Unsubscribe Content"
Cohesion: 0.17
Nodes (13): mailAbbestellungAusForm(), alsText(), angabenBlock(), TextOptionen, ABWAEHLBARE_ARTEN, ALLE_MAIL_ARTEN, istMailArt(), MAIL_ARTEN (+5 more)

### Community 39 - "Runtime Dependencies"
Cohesion: 0.12
Nodes (17): @astryxdesign/theme-neutral, @heroui/react, next, dependencies, @astryxdesign/theme-neutral, @heroui/react, jsqr, next (+9 more)

### Community 40 - "Sidebar Navigation"
Cohesion: 0.18
Nodes (12): Dichte, NavigatorProps, NavAktion, NavAktionen(), NavEintrag(), NavKunde(), NavStand(), NavVerweilen() (+4 more)

### Community 41 - "Google OAuth Callback"
Cohesion: 0.23
Nodes (12): GET(), POST(), GET(), GOOGLE_SCOPES, googleAuthUrl(), GoogleKonto, googleRedirectUri(), GoogleTausch (+4 more)

### Community 42 - "Connected Apps Mail"
Cohesion: 0.23
Nodes (12): AppsPage(), dynamic, Nachricht(), basisUrl(), bucheVersand(), VersandErgebnis, buche(), resend() (+4 more)

### Community 43 - "Audit Filters Vocabulary"
Cohesion: 0.18
Nodes (13): ProtokollFilter(), ProtokollFilterProps, AKTIONEN, AktionsArt, BEREICH_LABEL, EINGRIFFE, istAktion(), istEingriff() (+5 more)

### Community 44 - "Calendar Surface Design"
Cohesion: 0.14
Nodes (15): Folded Date Axis, Calendar Grid Selection Gesture, Monatsgitter, One Frame for All Routes, PersonenTafel, Yearly Week Resolution, ClockBar Deckung, Der gestempelte Tag (+7 more)

### Community 45 - "Avatar Personal Settings"
Cohesion: 0.25
Nodes (11): persoenlicheEinstellungenAusForm(), personalSettingsSaveAction(), AvatarAuswahl(), INITIAL, PersoenlicheEinstellungenForm(), TierAvatar(), AVATAR_KEYS, avatarBild() (+3 more)

### Community 46 - "Build Dependencies"
Cohesion: 0.13
Nodes (15): @astryxdesign/cli, devDependencies, @astryxdesign/cli, postcss, tailwindcss, @tailwindcss/postcss, @types/bun, @types/react (+7 more)

### Community 47 - "Google Calendar Sync"
Cohesion: 0.28
Nodes (11): frischesAccessToken(), EREIGNIS_FARBE, ereignisFuer(), ereignisStand(), ereignisTitel(), googleAufruf(), KalenderEreignis, legeEreignisAn() (+3 more)

### Community 48 - "OAuth Authorization Consent"
Cohesion: 0.27
Nodes (10): GET(), POST(), RFC-6749, dynamic, FreigabeSeite(), metadata, AbsendeKnopf(), getSessionUser() (+2 more)

### Community 49 - "Attention Toast Navigation"
Cohesion: 0.20
Nodes (10): AttentionToast(), AttentionToastProps, dayLink(), Meldungstext(), useClockOptional(), NavTagesstand(), TagesVerweis(), TagesVerweisProps (+2 more)

### Community 50 - "Email Theme Contrast"
Cohesion: 0.23
Nodes (11): MAILFARBEN, TON_FARBEN, NachrichtProps, MailInhalt, MailAuftrag, C, contrast(), luminance() (+3 more)

### Community 51 - "CSV Export Audit"
Cohesion: 0.36
Nodes (11): CSV_HEADERS(), feld(), GET(), protokollCsv(), spesenCsv(), werteText(), ProtokollListe(), ZeilenTafel() (+3 more)

### Community 52 - "Package Scripts Metadata"
Cohesion: 0.17
Nodes (11): name, peerDependencies, typescript, private, scripts, build, dev, start (+3 more)

### Community 53 - "Fragment Merge Script"
Cohesion: 0.18
Nodes (10): apply, db, fmtSeg(), lockedMonths, Plan, plans, skippedLocked, userArg (+2 more)

### Community 54 - "Icon Vocabulary Navigation"
Cohesion: 0.29
Nodes (9): AppNav(), MeineZeitEintrag(), ProtokollEintrag(), gefuellt(), mitForm(), umriss, zeichenFuer(), ZugangscodeFilter() (+1 more)

### Community 55 - "Settings Form"
Cohesion: 0.24
Nodes (8): aendern(), INITIAL, LAND_OPTIONS, SettingsForm(), SettingsFormProps, StufenFeld, VERSAND_LABEL, VersandZeile

### Community 56 - "Accounting Owl Avatar"
Cohesion: 0.24
Nodes (10): Accounting and Financial Control, Accounting and Controlling Owl Avatar, Budget Savings, Calculator, Expense Reconciliation, Finance Workload Fatigue, Long Receipt, Owl Accountant (+2 more)

### Community 57 - "Product Audit Principles"
Cohesion: 0.22
Nodes (9): Audit Activity Band, Append-Only Audit Log, SHA-256 Audit Hash Chain, ArbZG Warn-Only Rules, Non-Blocking Side Effects, Reliable Internal Time Tracking, Near-Zero Daily Effort, The Record Is the Product (+1 more)

### Community 58 - "Notice Messaging"
Cohesion: 0.22
Nodes (7): ICON_TON, MeldeAktion, MeldeFn, MeldeOptions, MeldeTon, SINN, TOAST_TYP

### Community 59 - "Animal Avatar Set"
Cohesion: 0.22
Nodes (9): Animal Avatar Set, Axolotl Avatar, Brown Marsupial Avatar, Capybara Avatar, Fox Avatar, Owl Avatar, Profile Avatar Choices, Raccoon Avatar (+1 more)

### Community 60 - "Account Octopus Avatar"
Cohesion: 0.28
Nodes (9): Account Portfolio, Anthropomorphic Octopus Professional, Binoculars, Client Insight and Retention, Golden Key, Key Account Management, Key Account Octopus Avatar, Multitasking (+1 more)

### Community 61 - "QR Code Reader"
Cohesion: 0.39
Nodes (7): Dekoder, detect(), jsqrDekoder(), macheDekoder(), QrLeser(), QrLeserProps, Window

### Community 62 - "Hospital Penguin Avatar"
Cohesion: 0.29
Nodes (8): Clinical Clipboard, Diagnostic Imaging, Hospital Care, Hospital Penguin Avatar, Medical Humor, Penguin Physician, Penguin X-Ray with Fish, Stethoscope

### Community 63 - "Travel Expense Data"
Cohesion: 0.29
Nodes (7): ReiseAngaben, ReiseEntscheidungAngaben, Reise, ReiseBeleg, SpesenRechnung, ReiseMitPerson, ReiseMitRechnung

### Community 64 - "Deployment Bootstrap"
Cohesion: 0.52
Nodes (4): bootstrapAdmin(), deploymentConfig, required(), valid

### Community 65 - "Marketing Peacock Avatar"
Cohesion: 0.33
Nodes (7): Anthropomorphic Peacock Mascot, Brand Creativity, Color Swatches, Colorful Professional Styling, Marketing Communication, Marketing Peacock Avatar, Megaphone

### Community 66 - "Executive Lion Avatar"
Cohesion: 0.33
Nodes (7): Anthropomorphic Lion Executive, Authority and Confidence, Business Growth, Crown, Executive Leadership, Executive Lion Avatar, Upward Growth Chart

### Community 67 - "Nursing Capybara Avatar"
Cohesion: 0.48
Nodes (7): Anthropomorphic Capybara Caregiver, Caregiver Fatigue Humor, Coffee IV Visual Joke, Mobile Care Medical Bag, Nursing Service Role, Patient Documentation Clipboard, Pflegedienst Capybara Avatar

### Community 68 - "Support Parrot Avatar"
Cohesion: 0.29
Nodes (7): Call-Center Headset and Microphone, Coffee Mug, Cheerful Customer-Support Persona, Grinning Green-and-Red Parrot, Headset-Calling Parrot Avatar, Infinity-Shaped Headset Cable, Thumbs-Up Gesture

### Community 69 - "Date Axis"
Cohesion: 0.53
Nodes (4): DatumsAchse(), datumsachse, tagPlus(), fmtMonthShort()

### Community 70 - "Business Eagle Avatar"
Cohesion: 0.60
Nodes (6): Anthropomorphic Bald Eagle Professional, Binocular Observation, Business Briefcase, Business Eagle Avatar, Elevated Ladder Viewpoint, Strategic Oversight

### Community 71 - "Absence Domain Rules"
Cohesion: 0.40
Nodes (5): Abwesenheit as a Span Record, day_types Projection, § 9 BUrlG Leave Refund, Antrag and Meldung Distinction, Google Absence Reconciliation

### Community 72 - "Travel Expense Rules"
Cohesion: 0.40
Nodes (5): Scrollable Computing Dialog, Calendar-Day Per Diem Calculation, Dated Rate Tier Frozen on Submission, Die Reise rechnet sich selbst, Trip Approval Workflow

### Community 73 - "OAuth Security Model"
Cohesion: 0.40
Nodes (5): Exact Redirect URI Matching, MedArbeiter OAuth Authorization-Code Flow, Single-Use Code Replay Protection, State-Bound CSRF Protection, MedArbeiter OAuth Hub

### Community 74 - "Database Test Setup"
Cohesion: 0.50
Nodes (5): createDb(), migrate(), setDbForTesting(), neuerNutzer(), frisch()

### Community 75 - "Sales Fox Avatar"
Cohesion: 0.70
Nodes (5): Anthropomorphic Fox Salesperson, Prospect Targeting, Sales Documentation, Telephone Outreach, Vertrieb und Akquise Fuchsavatar

### Community 76 - "CEO Panther Avatar"
Cohesion: 0.70
Nodes (5): Anthropomorphic Panther Executive, Chief Executive Officer Role, Executive Document Organizer, Mercedes-AMG CEO Panther Avatar, Mercedes-AMG Sports Car

### Community 77 - "PWA Icon 192"
Cohesion: 0.60
Nodes (5): Application Launcher Branding, Gold Heart Symbol, Healthcare Brand Identity, Heartbeat ECG Trace, MedArbeiter 192px Application Icon

### Community 78 - "PWA Icon 512"
Cohesion: 0.40
Nodes (5): EKG Pulse Line, Gold Heart Mark, Health-and-Progress Brand Symbol, MedArbeiter App Icon, Upward Arrow

### Community 79 - "Public Brand Logo"
Cohesion: 0.70
Nodes (5): Gold Heart Symbol, Healthcare Workforce Brand Identity, Heartbeat ECG Trace, MedArbeiter Horizontal Logo, MedArbeiter Wordmark

### Community 81 - "Source Brand Logo"
Cohesion: 0.67
Nodes (4): Healthcare Identity, Heart and Pulse Emblem, MedArbeiter Logo, MedArbeiter Wordmark

### Community 82 - "Square Brand Logo"
Cohesion: 0.83
Nodes (4): Gold Heart Symbol, Healthcare Brand Identity, Heartbeat ECG Trace, MedArbeiter Square Logo

### Community 83 - "Apple Touch Icon"
Cohesion: 0.83
Nodes (4): Gold Heart Symbol, Heartbeat ECG Trace, MedArbeiter Apple Touch Icon, Mobile Home Screen Branding

### Community 84 - "Public Logo Mark"
Cohesion: 0.67
Nodes (4): Gold Heart Shape, Healthcare Identity, Heart and Pulse Logo Mark, Pulse Waveform

### Community 85 - "Gold Color Discipline"
Cohesion: 0.67
Nodes (3): Spesen sind kein Gold, Gold-Is-Work Rule, Two-Stones Rule

### Community 88 - "Runtime Engine Versions"
Cohesion: 0.67
Nodes (3): engines, bun, node

## Knowledge Gaps
- **357 isolated node(s):** `dynamic`, `PageProps`, `dynamic`, `PageProps`, `dynamic` (+352 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDb()` connect `Receipt Storage API` to `Absence Review Actions`, `Audited Server Actions`, `Calendar Absence Pages`, `TOTP Access Codes`, `Team Shell Summaries`, `Notification Delivery`, `My Time Account`, `Database Schema Migrations`, `Employee Account Actions`, `Profile Google Connection`, `OAuth Token Server`, `Login Google Entry`, `Settings Mail Ledger`, `Time Segment Editing`, `Attention Issue Detection`, `Audit Log Chain`, `German Public Holidays`, `Reports and Print`, `OAuth App Administration`, `Google OAuth Callback`, `Connected Apps Mail`, `Google Calendar Sync`, `OAuth Authorization Consent`, `Fragment Merge Script`, `Deployment Bootstrap`, `Database Test Setup`, `Health Check API`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `Sinnbild` connect `Management PWA Pages` to `Absence Review Actions`, `Audited Server Actions`, `Calendar Absence Pages`, `Month Grid System`, `Time Lane Clock UI`, `My Time Account`, `Review Audit Lists`, `User Management State`, `Employee Account Actions`, `Trip Editor Allowances`, `Period Navigation`, `Settings Mail Ledger`, `Time Segment Editing`, `Trip List Expansion`, `Receipt Trip Detail`, `Authentication Form State`, `Reports and Print`, `Access Code UI`, `OAuth App Administration`, `Sidebar Navigation`, `Audit Filters Vocabulary`, `Avatar Personal Settings`, `Attention Toast Navigation`, `Icon Vocabulary Navigation`, `Settings Form`, `Notice Messaging`, `QR Code Reader`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `hatRecht()` connect `Employee Account Actions` to `Absence Review Actions`, `Audited Server Actions`, `Calendar Absence Pages`, `Reports and Print`, `Access Code UI`, `OAuth App Administration`, `Audit Log Chain`, `Team Shell Summaries`, `Receipt Storage API`, `TOTP Access Codes`, `Notification Delivery`, `User Management State`, `Trip Editor Allowances`, `CSV Export Audit`, `Profile Google Connection`, `OAuth Token Server`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `dynamic`, `PageProps`, `dynamic` to the rest of the system?**
  _357 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Absence Review Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.05113736554399577 - nodes in this community are weakly interconnected._
- **Should `Audited Server Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.0711849957374254 - nodes in this community are weakly interconnected._
- **Should `Calendar Absence Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.10196078431372549 - nodes in this community are weakly interconnected._