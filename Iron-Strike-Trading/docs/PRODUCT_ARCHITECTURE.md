# Iron Strike Trading — Product Architecture Document
## TrendSpider-Inspired, Doctrine-Aligned

**Version:** 1.0  
**Identity Lock:** "A decision intelligence platform for options traders."  
**Design Philosophy:** Software, not marketing. Dense interfaces. Risk before reward.

---

## TrendSpider Patterns Extracted

### 1. Navigation Structure (Mega-Menu Pattern)
TrendSpider uses a **4-category mega-menu** for public pages:
- **Products** → Platform overview with 7 capability pillars
- **Tools** → Free market data, scanners, calculators (trust-building)
- **Solutions** → Use case and industry-specific landing pages
- **Resources** → Learning center, documentation, support

**Iron Strike Translation:** Simplify to 4 public nav items aligned with doctrine:
- **Platform** → System overview (not feature list)
- **How It Works** → Operational transparency
- **Methodology** → Authority and trust
- **Pricing** → Commitment gate

### 2. Product Pillars (7 Capability Categories)
TrendSpider organizes features into workflow stages:
1. Analyze Charts & Market Data
2. Find New Trading Ideas
3. Create & Refine Strategies
4. Train Predictive AI Models
5. Deploy Alerts & Bots
6. Chat with AI Analyst
7. Build Custom Indicators

**Iron Strike Translation (Doctrine-Aligned):**
1. **Analyze** → Market context and risk evaluation
2. **Screen** → Structured opportunity filtering
3. **Signal** → Decision context generation (not recommendations)
4. **Review** → Performance feedback loops
5. **Alert** → Structured monitoring
6. **Journal** → Behavioral reflection

### 3. Pricing Philosophy
TrendSpider tiers by **capacity limits**, not feature lockout:
| Tier | Bots | Alerts | Workspaces | Scan Results |
|------|------|--------|------------|--------------|
| Standard | 5 | 10 | 2 | Limited |
| Premium | 25 | 50 | 4 | 250 |
| Advanced | 100 | 250 | 6 | Unlimited |

**Iron Strike Translation:**
- Free tier teaches structure (limited signals, basic journal)
- Paid tiers unlock control (more signals, advanced analytics, AI coaching)
- Premium unlocks depth (ML strategy engine, full backtesting)

### 4. Feature Density Strategy
TrendSpider uses **progressive disclosure**:
- Public pages show process, not dashboards
- Each product page has detailed capability breakdowns
- In-app interfaces are information-dense
- Tooltips and expandable sections manage complexity

**Iron Strike Application:**
- Zone I (Public): Process-focused, no screenshots of signals
- Zone II (Core): Dense control surfaces with risk prominence
- Zone III (Decision): Advanced features, earned access
- Zone IV (Account): Stability and transparency

---

## Iron Strike Page Architecture (Final)

### Zone I — Public/Authority (Pre-Login)

| Page | TrendSpider Equivalent | Iron Strike Doctrine Alignment |
|------|----------------------|-------------------------------|
| **Homepage** | Homepage | System preview, not tool showcase. Positioning: "Decision operating system for options traders." Workflow diagram, not feature grid. |
| **How It Works** | Product Overview | Step-by-step operational flow. Inputs → Processing → Outputs. Boundaries of responsibility. |
| **Methodology** | N/A (unique to Iron Strike) | Trust page. Model philosophy, confidence calibration, limitations, edge cases. What system refuses to do. |
| **Pricing** | Pricing | Capability progression framing. Responsibility of access. No urgency tactics. |

**Public Navigation (4 items):**
```
Platform | How It Works | Methodology | Pricing
```

---

### Zone II — Core System (Post-Login, Daily Use)

| Page | Purpose | Key Elements |
|------|---------|--------------|
| **Dashboard** | Control Surface | System status, active alerts, risk posture, recent activity. No recommendations. |
| **Charts** | Primary Analysis | Price context, indicator toggles, data provenance, timeframe controls. No auto-conclusions. |
| **Screener** | Opportunity Filtering | Transparent filter logic, why results appear, trade-offs. Never ranks by "best." |
| **Alerts** | Structured Monitoring | Trigger logic, delivery status, acknowledgment required. No alarmist language. |

**System Navigation (4-6 items max):**
```
Dashboard | Charts | Screener | Alerts | Signals | Journal
```

---

### Zone III — Decision Intelligence (Advanced Access)

| Page | Purpose | Key Elements |
|------|---------|--------------|
| **Signal Context** | Decision Framing | Context, probability, risk factors, historical analogs, confidence bounds. Never says "buy" or "sell." |
| **Strategy Performance** | Feedback Loop | Outcome vs rationale, risk alignment, behavioral patterns, mistake identification. |

---

### Zone IV — Account/Commitment

| Page | Purpose | Key Elements |
|------|---------|--------------|
| **Account Settings** | System Configuration | Preferences, notifications, security. No aggressive upsells. |
| **Billing** | Commercial Trust | Access level, renewal logic, clear cancellation. No hidden friction. |

---

## Design System — Iron Strike Precision Engine

### Color Palette (Locked)
| Token | Value | Usage |
|-------|-------|-------|
| Background Primary | `#0B0F14` | Main canvas |
| Background Secondary | `#0F141B` | Secondary surfaces |
| Background Card | `#141A22` | Elevated panels |
| Text Primary | `#E6EAF0` | Headlines |
| Text Secondary | `#9AA4B2` | Supporting text |
| Text Muted | `#6B7280` | Meta information |
| Accent | `#22D3EE` | ONE accent only (cyan) |

### Typography
- **UI Font:** Inter
- **Data Font:** JetBrains Mono
- **Scale:** H1=48px, H2=32px, H3=24px, Body=16px, Label=12px

### Component Rules
- Border radius max 6px
- No gradients (except hero moments)
- No glows, no shadows unless floating
- Accent used sparingly — never decoration
- Generous whitespace creates trust

---

## Monetization Structure (TrendSpider-Inspired)

### Tier Philosophy
Iron Strike sells **capability progression**, not features.

| Tier | Monthly | Annual | Target User |
|------|---------|--------|-------------|
| **Starter** | Free | Free | Learning structure |
| **Analyst** | $29 | $19/mo | Active swing traders |
| **Professional** | $79 | $59/mo | Serious options traders |
| **Institutional** | $199 | $149/mo | Professional/quantitative |

### Feature Limits by Tier
| Feature | Starter | Analyst | Professional | Institutional |
|---------|---------|---------|--------------|---------------|
| Signals/month | 10 | 50 | 200 | Unlimited |
| Journal entries | 20 | 100 | Unlimited | Unlimited |
| AI coaching | — | Basic | Full | Full + Priority |
| Strategy backtesting | — | — | Yes | Yes + ML |
| Alert channels | Email | Email + Discord | All | All + Webhook |
| Data export | — | — | Yes | Yes |

---

## Language Rules (Doctrine-Enforced)

### Always Use
- Neutral, precise, calm, declarative
- "Consider" not "should"
- "Indicates" not "confirms"
- "Risk context" not "opportunity"

### Never Use
- Hype, motivation, persuasion
- Emotional triggers, urgency framing
- "Best," "top," "winning," "guaranteed"
- Exclamation marks

### Examples
| Wrong | Right |
|-------|-------|
| "Hot signal! Act now!" | "Signal generated. Review context." |
| "Maximize your profits" | "Structure your decision process" |
| "AI recommends buying" | "AI provides analytical context" |

---

## Implementation Checklist

### Zone I (Public Pages)
- [ ] Homepage — System preview with workflow diagram
- [ ] How It Works — 5-step operational flow
- [ ] Methodology — Trust page with limitations
- [ ] Pricing — Capability progression matrix

### Zone II (Core System)
- [ ] Dashboard — Control surface, risk-first
- [ ] Charts — Dense analysis environment
- [ ] Screener — Transparent filtering
- [ ] Alerts — Structured monitoring

### Zone III (Decision Intelligence)
- [ ] Signal Context — Decision framing
- [ ] Strategy Performance — Feedback loops

### Zone IV (Account)
- [ ] Account Settings — Clean configuration
- [ ] Billing — Commercial trust surface

---

## Final Gate (The Iron Strike Test)

Before shipping any feature, page, or change:

1. Does this increase decision clarity?
2. Does this enforce discipline?
3. Does this respect user intelligence?
4. Does this slow users when necessary?
5. Does this increase trust over time?

**If any answer is "no," it does not ship.**

---

*Iron Strike is the last system a trader consults before acting.*
*Not because it promises certainty — but because it enforces structure where certainty does not exist.*
