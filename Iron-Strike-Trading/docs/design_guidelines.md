# Iron Strike Trading — Precision AI Engine Design System v1.0

> **This is a non-negotiable design lock.**
> Iron Strike is not a trading app. It is an AI decision engine.
> Everything must reinforce: calm authority, technical precision, quiet confidence, zero hype.
> If anything feels "cool," "flashy," or "fintech-y" — it is wrong.

---

## 1. Core Identity

Iron Strike is an AI decision engine that delivers institutional-grade options intelligence.

### Design Principles
- **Calm Authority** — Every element should feel deliberate and measured
- **Technical Precision** — Data presentation must be exact and trustworthy
- **Quiet Confidence** — Let results speak; eliminate decoration and hype
- **Zero Hype** — No badges, no animations, no "wow" moments

### What Iron Strike Is NOT
- Not a trading app with flashy dashboards
- Not a fintech product with gradients and glows
- Not a marketing site with animations and social proof
- Not a startup with excessive card layouts

---

## 2. Visual System (Locked)

### Backgrounds
| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| background | `#0B0F14` | `213 30% 6%` | Main background (deep charcoal) |
| canvas | `#0F141B` | `213 27% 8%` | Secondary canvas |
| surface | `#141A22` | `213 24% 11%` | Cards, panels |
| elevated | `#1B2230` | `213 22% 14%` | Modals, dropdowns |
| border | `rgba(255,255,255,0.08)` | — | Subtle borders |

**Rules:**
- No gradients on backgrounds (reserved for hero moments only)
- Subtle layering creates depth without decoration

### Text Hierarchy
| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| primary | `#E6EAF0` | `220 22% 92%` | Headlines, primary content |
| secondary | `#9AA4B2` | `213 12% 65%` | Supporting text, descriptions |
| muted | `#6B7280` | `220 8% 46%` | Meta information, timestamps |

**Rules:**
- Never drop below AA contrast
- Large text creates authority
- Use hierarchy to guide reading
- NO low-contrast gray-on-gray text

### Accent Color (ONLY ONE)
| Token | Hex | HSL |
|-------|-----|-----|
| accent | `#22D3EE` | `187 85% 53%` |

**Rules:**
- Used for focus, active states, confirmations ONLY
- Never used for decoration
- Never stacked
- Never glowing
- If accent feels noticeable, it's already too much

### State Colors (Text/Icon Only)
| Token | Hex | Usage |
|-------|-----|-------|
| success | `#22C55E` | Positive outcomes |
| warning | `#F59E0B` | Caution indicators |
| danger | `#EF4444` | Errors, risk alerts |

**Rules:**
- Use for text/icon colors ONLY
- Never use as background fills
- Apply sparingly

---

## 3. Typography

### Font Stack
```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
```

- **Headings:** Inter (clean, professional)
- **Numbers/Data:** JetBrains Mono (precision, readability)
- No stylistic fonts. No rounded nonsense.

### Scale
| Element | Size | Line Height | Weight |
|---------|------|-------------|--------|
| display | 48px | 1.1 | 600 |
| h1 | 36px | 1.1 | 600 |
| h2 | 28px | 1.2 | 600 |
| h3 | 22px | 1.3 | 500 |
| body | 16px | 1.6 | 400 |
| label | 12px | 1.4 | 500, uppercase |

### Usage Classes
```tsx
<h1 className="text-display">...</h1>  // 48px
<h1 className="text-hero">...</h1>     // 36-48px responsive
<h3 className="text-heading">...</h3>  // 22px
<p className="text-body">...</p>       // 16px
<span className="text-label">...</span> // 12px uppercase
```

---

## 4. Spacing System

Base unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| 1 | 4px | Micro spacing |
| 2 | 8px | Tight spacing |
| 3 | 12px | Small gaps |
| 4 | 16px | Standard spacing |
| 6 | 24px | Section padding |
| 8 | 32px | Large gaps |
| 12 | 48px | Section margins |
| 16 | 64px | Major sections |

**Principle:** Whitespace creates trust. When in doubt, add more space.

---

## 5. Component System

### Required Components
- **Panel** — Base container with border and background
- **StatCard** — Numbers with labels and optional trends
- **PageHeader** — Title, description, actions
- **EmptyState** — Explanation + next action
- **FiltersBar** — Horizontal filter strip
- **LoadingSkeleton** — Placeholder states

### General Rules
- One primary action per screen
- Data > decoration
- Panels feel fixed and deliberate
- No stacked cards
- No excessive nesting

### Radius Scale
| Token | Value | Usage |
|-------|-------|-------|
| small | 4px | Badges, small elements |
| medium | 8px | Cards, panels |
| large | 12px | Modals, large containers |

---

## 6. Navigation Architecture

### Tier 1 (Always Visible)
- Dashboard
- Signal Generator
- Live Signals
- Charts
- Alerts

### Tier 2 (Tools Dropdown)
- Watchlist
- Screener
- Portfolio / Trade Tracker
- Strategy Performance
- Confidence Calibration
- You vs AI
- Performance KPIs

### Tier 3 (Account Menu)
- Settings
- Plan & Billing
- Integrations
- Support

### Tier 4 (Footer Only)
- Risk Disclosure
- Privacy Policy
- Terms of Service
- Data Sources

### Mobile Navigation
- Bottom nav for Tier 1
- Slide-out drawer for Tier 2 and Account

---

## 7. Page Layout Archetypes

### Dashboard (Command Center)
- Multi-column grid layout
- System status panel
- Active signals/alerts
- Quick actions
- No nested cards

### Signal Generator (CRITICAL)
- Split layout: controls left, output right
- Structured AI output rendering
- Clear risk + invalidation zones
- Calm, institutional presentation

### Charts
- Full-width dense layout
- TradingView-style interaction
- Indicators, drawings, timeframes

### Tools Pages
- PageHeader with filters
- Results table or panel grid

### Analytics Pages
- Tabs for navigation
- Comparison panels
- Charts + data tables

### Settings
- Left sub-navigation
- Content area right
- Sticky save actions

---

## 8. Homepage Structure

### Hero
- Headline: calm, declarative, authoritative
- Subhead: discipline + decision intelligence
- Primary CTA: "Enter the system"
- Secondary CTA: "View methodology"

### No Feature Dumping
- Focus on system overview
- What it does / does NOT do
- Core capabilities (5-6 max)
- Pricing preview
- Risk disclosure

### Tone
- Assume competence
- Invite curiosity
- Never try to "prove worth"

---

## 9. Don'ts (Critical)

- ❌ No gradients (except hero moments)
- ❌ No glows or shadows unless floating
- ❌ No green/colored backgrounds
- ❌ No stacked accent usage
- ❌ No generic SaaS templates
- ❌ No repeated layouts across pages
- ❌ No low-contrast gray-on-gray
- ❌ No excessive card nesting
- ❌ No hype language
- ❌ No emojis
