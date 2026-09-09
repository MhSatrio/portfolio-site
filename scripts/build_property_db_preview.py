"""Generate property-database-preview.html — a censored, view-only preview of the
Indonesia Property BD Database, following the same protected-preview design system
as revops-preview.html.

Usage: python scripts/build_property_db_preview.py
"""
import csv
import html
import os
from collections import Counter
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(os.path.dirname(ROOT), "property-database")
OUT_PATH = os.path.join(ROOT, "property-database-preview.html")

PEOPLE_KEEP = {"ID", "Category", "Subcategory", "Country", "Verification Status", "Priority Score"}
COMPANY_KEEP = {"ID", "Category", "Subcategory", "Country", "Verification Status", "Priority Score"}


def censor(value):
    s = (value or "").strip()
    if len(s) <= 3:
        return s
    return s[:3] + "*" * (len(s) - 3)



# Explicit mapping from every raw Category string in the database to a clean
# top-level bucket for display purposes (raw strings vary across research
# batches/agents; this keeps the portfolio-facing "categories" count honest
# and readable instead of showing ~100 near-duplicate labels).
CATEGORY_BUCKET_MAP = {
    "Architecture": "Architecture & Design",
    "Architecture & Design": "Architecture & Design",
    "Banking & Finance": "Banking & Financial / Mortgage",
    "Boutique Real Estate Agency": "Real Estate / Property Agencies",
    "Business / Investment Consultancy": "Legal, Notary & Corporate Advisory",
    "Business / Visa Consultancy": "Tax & Immigration Advisory",
    "Business Setup & Consultancy": "Legal, Notary & Corporate Advisory",
    "Buyer's Agency": "Real Estate / Property Agencies",
    "Buyer's Agent / Investment Advisory": "Real Estate / Property Agencies",
    "Commercial Real Estate": "Real Estate / Property Agencies",
    "Commercial Real Estate Consultancy": "Real Estate / Property Agencies",
    "Commercial Real Estate Services": "Real Estate / Property Agencies",
    "Corporate & Advisory Services": "Legal, Notary & Corporate Advisory",
    "Corporate & Legal Services": "Legal, Notary & Corporate Advisory",
    "Corporate Services": "Legal, Notary & Corporate Advisory",
    "Coworking/Digital Nomad Hub": "Relocation, Expat & Digital Nomad Services",
    "Digital Nomad Community Platform": "Relocation, Expat & Digital Nomad Services",
    "Due Diligence/Compliance": "Legal, Notary & Corporate Advisory",
    "Family Office / Trust Services": "Wealth / Investment / Family Office",
    "Family Office / Wealth Management": "Wealth / Investment / Family Office",
    "Financial / Mortgage": "Banking & Financial / Mortgage",
    "Financial Institution": "Banking & Financial / Mortgage",
    "Global Luxury Real Estate Franchise": "International Agencies & Listing Platforms",
    "Global Real Estate Consultancy": "International Agencies & Listing Platforms",
    "Global Real Estate Services Firm": "International Agencies & Listing Platforms",
    "Hospitality": "Hospitality",
    "Hospitality / Hotel Operator": "Hospitality",
    "Immigration & Visa Consultancy": "Tax & Immigration Advisory",
    "Immigration & Visa Consultancy / Legal Services": "Tax & Immigration Advisory",
    "Immigration/Visa Consultancy": "Tax & Immigration Advisory",
    "Immigration/Visa Services": "Tax & Immigration Advisory",
    "Industry Association": "Industry Association",
    "International Agency": "International Agencies & Listing Platforms",
    "Investment Fund": "Wealth / Investment / Family Office",
    "Investment Fund / Venture Capital": "Wealth / Investment / Family Office",
    "Investment Property Advisory": "Real Estate / Property Agencies",
    "Land & Tax Consulting": "Legal, Notary & Corporate Advisory",
    "Land Broker / Investment Advisory": "Real Estate / Property Agencies",
    "Land Services": "Legal, Notary & Corporate Advisory",
    "Legal & Immigration Advisory": "Tax & Immigration Advisory",
    "Legal & Notary Services": "Legal, Notary & Corporate Advisory",
    "Legal & Property Advisory": "Legal, Notary & Corporate Advisory",
    "Legal / Land Due Diligence": "Legal, Notary & Corporate Advisory",
    "Legal Services": "Legal, Notary & Corporate Advisory",
    "Legal, Tax & Relocation Advisory": "Legal, Notary & Corporate Advisory",
    "Luxury Real Estate Brokerage": "International Agencies & Listing Platforms",
    "Luxury Real Estate Network": "International Agencies & Listing Platforms",
    "Luxury Travel & Lifestyle": "Luxury Travel, Yacht & Private Aviation",
    "Media & Marketing": "Media & Marketing",
    "Media / Content": "Media & Marketing",
    "Media / Luxury Property Listing Platform": "International Agencies & Listing Platforms",
    "Notary & PPAT Services": "Legal, Notary & Corporate Advisory",
    "Notary/PPAT Services": "Legal, Notary & Corporate Advisory",
    "Private Aviation": "Luxury Travel, Yacht & Private Aviation",
    "Private Members Club": "Private Members' Clubs & Networks",
    "Private Members Club / Business Network": "Private Members' Clubs & Networks",
    "Private Members' Club": "Private Members' Clubs & Networks",
    "PropTech": "PropTech",
    "PropTech / Financial": "PropTech",
    "PropTech / Media": "PropTech",
    "Property Agency": "Real Estate / Property Agencies",
    "Property Consultant": "Real Estate / Property Agencies",
    "Property Consultant / Land Broker": "Real Estate / Property Agencies",
    "Property Developer": "Property Development",
    "Property Development": "Property Development",
    "Property Development & Management": "Property Development",
    "Property Development / Real Estate Agency": "Property Development",
    "Property Investment Advisory": "Real Estate / Property Agencies",
    "Property Listing Platform": "International Agencies & Listing Platforms",
    "Property Management & Investment Consultancy": "Real Estate / Property Agencies",
    "Property Market Research & Education": "Media & Marketing",
    "Real Estate & Investment Consultancy": "Real Estate / Property Agencies",
    "Real Estate / Property": "Real Estate / Property Agencies",
    "Real Estate Agency": "Real Estate / Property Agencies",
    "Real Estate Agency - Boutique": "Real Estate / Property Agencies",
    "Real Estate Agency - Boutique / Investment Advisory": "Real Estate / Property Agencies",
    "Real Estate Agency - Franchise": "Real Estate / Property Agencies",
    "Real Estate Agency / Brokerage": "Real Estate / Property Agencies",
    "Real Estate Agency / Brokerage Platform": "Real Estate / Property Agencies",
    "Real Estate Agent/Broker": "Real Estate / Property Agencies",
    "Real Estate Brokerage": "Real Estate / Property Agencies",
    "Real Estate Brokerage Network": "Real Estate / Property Agencies",
    "Real Estate Developer": "Property Development",
    "Real Estate Franchise": "Real Estate / Property Agencies",
    "Real Estate Investment Advisory": "Real Estate / Property Agencies",
    "Real Estate Services": "Real Estate / Property Agencies",
    "Regional Real Estate Agency": "Real Estate / Property Agencies",
    "Regional Real Estate Agency / Land Investment": "Real Estate / Property Agencies",
    "Regional Real Estate Development & Agency": "Property Development",
    "Relocation & Expat Services": "Relocation, Expat & Digital Nomad Services",
    "Relocation & Immigration": "Relocation, Expat & Digital Nomad Services",
    "Relocation & Mobility": "Relocation, Expat & Digital Nomad Services",
    "Relocation Services": "Relocation, Expat & Digital Nomad Services",
    "Tax & Accounting Advisory": "Tax & Immigration Advisory",
    "Tax Advisory": "Tax & Immigration Advisory",
    "Wealth/Investment/Family Office": "Wealth / Investment / Family Office",
    "Wellness/Hospitality": "Hospitality",
    "Yacht Broker": "Luxury Travel, Yacht & Private Aviation",
    "Yacht Broker / Luxury Charter": "Luxury Travel, Yacht & Private Aviation",
    "Yacht Broker / Superyacht Agent": "Luxury Travel, Yacht & Private Aviation",
    "Yacht Brokerage": "Luxury Travel, Yacht & Private Aviation",
}


def bucket_category(raw):
    return CATEGORY_BUCKET_MAP.get(raw.strip(), raw.strip())


def load_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)
    return header, rows


def build_table(header, rows, keep_cols):
    keep_idx = {i for i, col in enumerate(header) if col in keep_cols}
    parts = ["<tr>"]
    for col in header:
        parts.append(f"<td>{html.escape(col)}</td>")
    parts.append("</tr>\n")
    for row in rows:
        row = list(row) + [""] * (len(header) - len(row))
        parts.append("<tr>")
        for i, col in enumerate(header):
            val = row[i] if i < len(row) else ""
            shown = val if i in keep_idx else censor(val)
            cls = " class='blank'" if not shown else ""
            parts.append(f"<td{cls}>{html.escape(shown)}</td>")
        parts.append("</tr>\n")
    return "".join(parts)


def main():
    people_header, people_rows = load_csv(os.path.join(DB_DIR, "people_master.csv"))
    companies_header, companies_rows = load_csv(os.path.join(DB_DIR, "companies_master.csv"))

    people_count = len(people_rows)
    companies_count = len(companies_rows)

    country_idx_p = people_header.index("Country")
    country_idx_c = companies_header.index("Country")
    countries = set(r[country_idx_p].strip() for r in people_rows) | set(r[country_idx_c].strip() for r in companies_rows)
    countries.discard("")

    cat_idx_p = people_header.index("Category")
    cat_idx_c = companies_header.index("Category")
    raw_categories = set(r[cat_idx_p].strip() for r in people_rows) | set(r[cat_idx_c].strip() for r in companies_rows)
    raw_categories.discard("")
    categories = {bucket_category(c) for c in raw_categories}

    prio_idx_p = people_header.index("Priority Score")
    prio_idx_c = companies_header.index("Priority Score")
    p5 = sum(1 for r in people_rows if r[prio_idx_p].strip() == "5") + sum(1 for r in companies_rows if r[prio_idx_c].strip() == "5")

    today = date.today().strftime("%B %d, %Y")

    people_table = build_table(people_header, people_rows, PEOPLE_KEEP)
    companies_table = build_table(companies_header, companies_rows, COMPANY_KEEP)

    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Indonesia Property BD Database — Confidential Preview | Muhammad Satrio</title>
<meta name="description" content="A {people_count + companies_count}+ record business-development database for an Indonesian property business — redacted, view-only preview.">
<meta name="robots" content="noindex, nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,500;1,400&display=swap" rel="stylesheet">
<style>
:root {{
  --bg: #0a0a0c;
  --surface: #131316;
  --surface-raised: #18181c;
  --border: #26262b;
  --text: #f2f2f0;
  --text-secondary: #a3a3ab;
  --text-tertiary: #6c6c74;
  --gold: #c9a86a;
  --gold-dim: #8a7550;
}}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
html {{ scroll-behavior: smooth; }}
body {{
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  -webkit-user-select: none; -moz-user-select: none; user-select: none;
  cursor: default;
}}
a {{ color: inherit; }}
::selection {{ background: transparent; }}

.watermark {{
  position: fixed; inset: 0; z-index: 999; pointer-events: none;
  opacity: 0.055;
  background-image: repeating-linear-gradient(-35deg, transparent, transparent 220px, rgba(255,255,255,0.001) 220px);
}}
.watermark span {{
  position: absolute; white-space: nowrap; font-size: 13px; letter-spacing: 0.18em;
  color: #fff; font-weight: 600; transform: rotate(-35deg);
}}

.topbar {{
  position: sticky; top: 0; z-index: 40;
  background: rgba(10,10,12,0.92); backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  padding: 16px 28px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
}}
.brand {{ display: flex; flex-direction: column; gap: 2px; }}
.brand .word {{
  font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: 26px;
  letter-spacing: 0.03em; color: var(--text);
}}
.brand .tag {{
  font-size: 10.5px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold);
}}
.viewonly-badge {{
  font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--text-secondary); border: 1px solid var(--border); border-radius: 999px;
  padding: 6px 14px; display: inline-flex; align-items: center; gap: 8px;
}}
.viewonly-badge::before {{ content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--gold); }}
.back-link {{ font-size: 13px; color: var(--text-secondary); border: 1px solid var(--border); padding: 8px 16px; border-radius: 999px; }}
.back-link:hover {{ border-color: var(--gold-dim); color: var(--text); }}

.hero {{
  padding: 96px 28px 64px; max-width: 880px; margin: 0 auto; text-align: center;
}}
.hero .eyebrow {{
  font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--gold);
  margin-bottom: 22px; display: block;
}}
.hero h1 {{
  font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: clamp(36px, 5.4vw, 60px);
  line-height: 1.15; letter-spacing: 0.01em; margin-bottom: 22px;
}}
.hero p.lede {{
  color: var(--text-secondary); font-size: 17px; max-width: 660px; margin: 0 auto 28px;
}}
.hero-stats {{
  display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; margin-top: 36px;
  padding-top: 28px; border-top: 1px solid var(--border);
}}
.hero-stats .stat-num {{
  font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 30px; color: var(--gold);
}}
.hero-stats .stat-label {{
  font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-tertiary); margin-top: 4px;
}}
.notice {{
  max-width: 660px; margin: 32px auto 0; font-size: 13px; color: var(--text-tertiary);
  border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px;
}}
.notice.redact {{ border-color: var(--gold-dim); color: var(--text-secondary); text-align: left; }}
.notice.redact b {{ color: var(--gold); }}

.tabnav-wrap {{ position: sticky; top: 73px; z-index: 30; background: var(--bg); border-bottom: 1px solid var(--border); }}
.tabnav {{
  display: flex; gap: 6px; overflow-x: auto; padding: 12px 28px; max-width: 1280px; margin: 0 auto;
  scrollbar-width: thin;
}}
.tab-btn {{
  flex: none; background: var(--surface); border: 1px solid var(--border); color: var(--text-secondary);
  font-family: inherit; font-size: 12.5px; padding: 9px 14px; border-radius: 10px; cursor: pointer;
  white-space: nowrap; transition: border-color .15s ease, color .15s ease;
}}
.tab-btn span {{ color: var(--text-tertiary); margin-left: 6px; }}
.tab-btn:hover {{ border-color: var(--gold-dim); color: var(--text); }}
.tab-btn.active {{ border-color: var(--gold); color: var(--text); background: var(--surface-raised); }}

.sheets {{ max-width: 1280px; margin: 0 auto; padding: 8px 28px 120px; }}
.sheet-section {{ padding: 56px 0; border-bottom: 1px solid var(--border); }}
.sheet-section:last-child {{ border-bottom: none; }}
.sheet-head {{ display: flex; gap: 20px; align-items: baseline; margin-bottom: 22px; }}
.sheet-num {{
  font-family: 'Cormorant Garamond', serif; font-size: 15px; color: var(--gold); letter-spacing: 0.08em;
  border: 1px solid var(--gold-dim); border-radius: 8px; padding: 4px 10px; flex: none;
}}
.sheet-head h3 {{ font-size: 22px; font-weight: 600; margin-bottom: 4px; }}
.sheet-head p {{ color: var(--text-secondary); font-size: 14px; max-width: 640px; }}

.stat-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 8px; }}
.stat-card {{ border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 18px; }}
.stat-card .n {{ font-family: 'Cormorant Garamond', serif; font-size: 32px; color: var(--gold); }}
.stat-card .l {{ font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-tertiary); margin-top: 4px; }}

.table-scroll {{
  overflow-x: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--surface);
  max-height: 640px; overflow-y: auto;
}}
table {{ border-collapse: collapse; font-size: 12px; min-width: 100%; }}
td {{
  padding: 6px 10px; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border);
  white-space: nowrap; color: var(--text-secondary);
}}
tr:first-child td {{
  color: var(--text); font-weight: 600; background: var(--surface-raised);
  position: sticky; top: 0; z-index: 5;
}}
td.blank {{ color: var(--text-tertiary); }}
.empty-note {{ color: var(--text-tertiary); font-size: 13px; padding: 20px; }}

.footer-note {{
  text-align: center; padding: 48px 28px 80px; color: var(--text-tertiary); font-size: 12.5px;
  max-width: 660px; margin: 0 auto;
}}

@media print {{
  body * {{ display: none !important; }}
  body::after {{
    content: 'Printing and saving this page is disabled.';
    display: block !important; padding: 120px 40px; text-align: center; font-size: 20px;
  }}
}}

@media (max-width: 640px) {{
  .topbar {{ padding: 14px 18px; }}
  .hero {{ padding: 64px 18px 44px; }}
  .sheets {{ padding: 8px 18px 90px; }}
}}
</style>
</head>
<body oncontextmenu="return false" ondragstart="return false">

<div class="watermark" id="watermark"></div>

<div class="topbar">
  <div class="brand">
    <span class="word">Indonesia Property BD Database</span>
    <span class="tag">Confidential Preview · Redacted</span>
  </div>
  <div style="display:flex; align-items:center; gap:14px;">
    <span class="viewonly-badge">View only · Redacted</span>
    <a class="back-link" href="index.html">&larr; Back to portfolio</a>
  </div>
</div>

<section class="hero">
  <span class="eyebrow">Business Development &middot; Research Database</span>
  <h1>A curated business-development database<br>for an Indonesian property business.</h1>
  <p class="lede">A batched, source-verified research pipeline that finds and qualifies real people and companies who could realistically buy, sell, refer, develop, finance, or market Indonesian property — across real estate, legal, architecture, hospitality, wealth, and more. This is a redacted, read-only preview of the live working database.</p>
  <div class="hero-stats">
    <div><div class="stat-num">{people_count + companies_count}+</div><div class="stat-label">Records so far</div></div>
    <div><div class="stat-num">{len(categories)}</div><div class="stat-label">Categories</div></div>
    <div><div class="stat-num">{len(countries)}</div><div class="stat-label">Countries</div></div>
    <div><div class="stat-num">{p5}</div><div class="stat-label">Priority-5 leads</div></div>
  </div>
  <p class="notice redact"><b>Confidential — redacted duplicate.</b> Names, job titles, companies, cities, contact details, and descriptive fields are masked — only the first 3 characters of each value are shown, the rest replaced with asterisks. Category, subcategory, country, verification status, and priority score are left visible to show the structure and quality of the research without exposing real prospects. This preview does not represent the complete dataset — the live database is an ongoing research project and the full list is expected to grow well above 1,000 records across both tables. Snapshot as of {today}.</p>
</section>

<div class="tabnav-wrap">
  <div class="tabnav" id="tabnav">
<button class="tab-btn" data-target="00-overview">00 <span>Overview</span></button>
<button class="tab-btn" data-target="01-people">01 <span>People</span></button>
<button class="tab-btn" data-target="02-companies">02 <span>Companies</span></button>
  </div>
</div>

<div class="sheets" id="sheets">

  <section class="sheet-section" id="00-overview">
    <div class="sheet-head">
      <span class="sheet-num">00</span>
      <div>
        <h3>Overview</h3>
        <p>Snapshot of the live database as of {today}. Every record is a real, individually source-verified person or company — not a scraped directory dump.</p>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="n">{people_count}</div><div class="l">People records</div></div>
      <div class="stat-card"><div class="n">{companies_count}</div><div class="l">Company records</div></div>
      <div class="stat-card"><div class="n">{len(categories)}</div><div class="l">Categories covered</div></div>
      <div class="stat-card"><div class="n">{len(countries)}</div><div class="l">Countries covered</div></div>
      <div class="stat-card"><div class="n">{p5}</div><div class="l">Priority-5 (highest-fit) leads</div></div>
    </div>
  </section>

  <section class="sheet-section" id="01-people">
    <div class="sheet-head">
      <span class="sheet-num">01</span>
      <div>
        <h3>People</h3>
        <p>Individuals who could realistically introduce, refer, or transact — agents, investors, architects, lawyers, wealth managers, and more. Redacted below.</p>
      </div>
    </div>
    <div class='table-scroll'><table>
{people_table}</table></div>
  </section>

  <section class="sheet-section" id="02-companies">
    <div class="sheet-head">
      <span class="sheet-num">02</span>
      <div>
        <h3>Companies</h3>
        <p>Agencies, developers, law firms, hospitality operators, and other organizations that could become partners, referral sources, or clients. Redacted below.</p>
      </div>
    </div>
    <div class='table-scroll'><table>
{companies_table}</table></div>
  </section>

</div>

<p class="footer-note">Indonesia Property BD Database — researched and built by Muhammad Satrio. This is a redacted duplicate shown for portfolio purposes only; it does not represent the full or current dataset and grants no access to the underlying records.</p>

<script>
(function () {{
  var wm = document.getElementById('watermark');
  var label = 'MUHAMMAD SATRIO · REDACTED PREVIEW';
  for (var y = -100; y < window.innerHeight + 400; y += 140) {{
    for (var x = -200; x < window.innerWidth + 400; x += 420) {{
      var s = document.createElement('span');
      s.style.left = x + 'px'; s.style.top = y + 'px';
      s.textContent = label;
      wm.appendChild(s);
    }}
  }}

  var buttons = document.querySelectorAll('.tab-btn');
  var sections = document.querySelectorAll('.sheet-section');
  buttons.forEach(function (btn) {{
    btn.addEventListener('click', function () {{
      var target = document.getElementById(btn.dataset.target);
      if (target) target.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
    }});
  }});
  var io = new IntersectionObserver(function (entries) {{
    entries.forEach(function (e) {{
      if (e.isIntersecting) {{
        buttons.forEach(function (b) {{ b.classList.remove('active'); }});
        var btn = document.querySelector('.tab-btn[data-target="' + e.target.id + '"]');
        if (btn) {{ btn.classList.add('active'); btn.scrollIntoView({{ behavior: 'smooth', inline: 'center', block: 'nearest' }}); }}
      }}
    }});
  }}, {{ rootMargin: '-160px 0px -70% 0px' }});
  sections.forEach(function (s) {{ io.observe(s); }});

  document.addEventListener('contextmenu', function (e) {{ e.preventDefault(); }});
  document.addEventListener('dragstart', function (e) {{ e.preventDefault(); }});
  document.addEventListener('selectstart', function (e) {{ e.preventDefault(); }});
  document.addEventListener('copy', function (e) {{ e.preventDefault(); }});
  document.addEventListener('cut', function (e) {{ e.preventDefault(); }});
  document.addEventListener('keydown', function (e) {{
    var k = e.key ? e.key.toLowerCase() : '';
    var blockedCombo = (e.ctrlKey || e.metaKey) && ['c', 's', 'p', 'u', 'a', 'x'].indexOf(k) !== -1;
    var devtools = (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].indexOf(k) !== -1) || k === 'f12';
    if (blockedCombo || devtools) e.preventDefault();
  }});
}})();
</script>
</body>
</html>
"""

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"Wrote {OUT_PATH} ({os.path.getsize(OUT_PATH)/1024:.1f} KB)")
    print(f"People: {people_count}, Companies: {companies_count}, Categories: {len(categories)}, Countries: {len(countries)}, Priority-5: {p5}")


if __name__ == "__main__":
    main()
