from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    Table, LongTable, TableStyle, Flowable, KeepTogether,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf"
MIGRATIONS = ROOT / "supabase" / "migrations"
SCHEMA = ROOT / "supabase" / "schema-v2.sql"
DATE = "24 October 2026"
INK = colors.HexColor("#1e342b")
BRASS = colors.HexColor("#a48762")
PAPER = colors.HexColor("#f5f3ee")
MUTED = colors.HexColor("#657168")
LINE = colors.HexColor("#dfdbd1")
PALE = colors.HexColor("#eff2ec")

font_dir = Path("C:/Windows/Fonts")
if (font_dir / "arial.ttf").exists():
    pdfmetrics.registerFont(TTFont("Arial", str(font_dir / "arial.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Bold", str(font_dir / "arialbd.ttf")))
    FONT, BOLD = "Arial", "Arial-Bold"
else:
    FONT, BOLD = "Helvetica", "Helvetica-Bold"


def strip_sql_comments(sql):
    sql = re.sub(r"/\*[\s\S]*?\*/", "", sql)
    return re.sub(r"(?m)^\s*--.*$", "", sql)


def split_top_level(text):
    rows, start, depth, quote = [], 0, 0, None
    for i, char in enumerate(text):
        if quote:
            if char == quote:
                quote = None
            continue
        if char in "\"'":
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == "," and depth == 0:
            rows.append(text[start:i].strip())
            start = i + 1
    if text[start:].strip():
        rows.append(text[start:].strip())
    return rows


def load_sql_sources():
    files = [SCHEMA] + sorted(MIGRATIONS.glob("*.sql"))
    return [(p, strip_sql_comments(p.read_text(encoding="utf-8"))) for p in files if p.exists()]


def inventory():
    tables = {}
    indexes, functions, triggers, policies = {}, {}, {}, {}
    for path, sql in load_sql_sources():
        for match in re.finditer(r"create\s+table(?:\s+if\s+not\s+exists)?\s+((?:public|private)\.[\w]+)\s*\(", sql, re.I):
            name, pos = match.group(1).lower(), match.end()
            depth, end = 1, pos
            while end < len(sql) and depth:
                if sql[end] == "(": depth += 1
                elif sql[end] == ")": depth -= 1
                end += 1
            columns = tables.setdefault(name, {})
            for item in split_top_level(sql[pos:end - 1]):
                bits = item.strip().split()
                if len(bits) < 2 or bits[0].lower() in {"constraint", "primary", "foreign", "unique", "check", "exclude"}:
                    continue
                col = bits[0].strip('"').lower()
                if re.match(r"^[a-z_][a-z0-9_$]*$", col, re.I):
                    typ = bits[1].lower()
                    if typ == "double" and len(bits) > 2: typ += " " + bits[2].lower()
                    columns[col] = typ
        # Add-column statements accumulate the current migration-era superset.
        for match in re.finditer(r"alter\s+table\s+(public|private)\.([\w]+)([\s\S]*?);", sql, re.I):
            table = f"{match.group(1).lower()}.{match.group(2).lower()}"
            tail = match.group(3)
            for add in re.finditer(r"add\s+column(?:\s+if\s+not\s+exists)?\s+([\w\"]+)\s+([a-zA-Z]+(?:\s*\([^)]*\))?(?:\[\])?)", tail, re.I):
                col, typ = add.group(1).strip('"').lower(), add.group(2).lower()
                tables.setdefault(table, {})[col] = typ
        for match in re.finditer(r"create\s+(?:unique\s+)?index(?:\s+if\s+not\s+exists)?\s+([\w]+)\s+on\s+([\w.]+)[\s\S]*?;", sql, re.I):
            stmt = " ".join(match.group(0).split())
            indexes[match.group(1).lower()] = (match.group(2).lower(), stmt, path.name)
        for match in re.finditer(r"create(?:\s+or\s+replace)?\s+function\s+([\w.]+)\s*\(", sql, re.I):
            functions[match.group(1).lower()] = path.name
        for match in re.finditer(r"create\s+trigger\s+([\w]+)\s+([\s\S]*?);", sql, re.I):
            triggers[match.group(1).lower()] = " ".join(match.group(2).split())[:180]
        for match in re.finditer(r"create\s+policy\s+\"([^\"]+)\"\s+on\s+([\w.]+)", sql, re.I):
            policies[(match.group(1), match.group(2).lower())] = path.name
    return tables, indexes, functions, triggers, policies


TABLES, INDEXES, FUNCTIONS, TRIGGERS, POLICIES = inventory()


def foreign_key_inventory():
    found = {}
    for path, sql in load_sql_sources():
        for match in re.finditer(r"create\s+table(?:\s+if\s+not\s+exists)?\s+((?:public|private)\.[\w]+)\s*\(", sql, re.I):
            source, pos = match.group(1).lower(), match.end()
            depth, end = 1, pos
            while end < len(sql) and depth:
                if sql[end] == "(": depth += 1
                elif sql[end] == ")": depth -= 1
                end += 1
            for item in split_top_level(sql[pos:end-1]):
                fk = re.search(r"(?:foreign\s+key\s*\(\s*([\w]+)\s*\)|^\s*([\w]+)\s+[^,]+?)\s+references\s+((?:public|private|auth|storage)\.[\w]+)\s*\(\s*([\w]+)\s*\)", item, re.I)
                if fk:
                    col = fk.group(1) or fk.group(2)
                    found[(source, col.lower(), fk.group(3).lower(), fk.group(4).lower())] = path.name
        for match in re.finditer(r"alter\s+table\s+((?:public|private)\.[\w]+)([\s\S]*?);", sql, re.I):
            for fk in re.finditer(r"foreign\s+key\s*\(\s*([\w]+)\s*\)\s+references\s+((?:public|private|auth|storage)\.[\w]+)\s*\(\s*([\w]+)\s*\)", match.group(2), re.I):
                found[(match.group(1).lower(), fk.group(1).lower(), fk.group(2).lower(), fk.group(3).lower())] = path.name
    return found


def edge_env_inventory():
    env = {}
    for path in sorted((ROOT / "supabase" / "functions").glob("**/*.ts")):
        for key in re.findall(r"Deno\.env\.get\(\s*['\"]([^'\"]+)", path.read_text(encoding="utf-8")):
            env.setdefault(key, set()).add(path.parent.name)
    return env


FOREIGN_KEYS = foreign_key_inventory()
EDGE_ENV = edge_env_inventory()


class BrandDoc(BaseDocTemplate):
    def __init__(self, filename, title, pagesize=A4, **kw):
        self.title_text = title
        w, h = pagesize
        super().__init__(filename, pagesize=pagesize, leftMargin=18*mm, rightMargin=18*mm, topMargin=21*mm, bottomMargin=18*mm, title=title, author="TSOGO-BIS", **kw)
        frame = Frame(self.leftMargin, self.bottomMargin, w-self.leftMargin-self.rightMargin, h-self.topMargin-self.bottomMargin, id="normal")
        self.addPageTemplates(PageTemplate(id="brand", frames=frame, onPage=self.page_art))

    def page_art(self, canvas, doc):
        canvas.saveState()
        w, h = doc.pagesize
        canvas.setFillColor(INK); canvas.rect(0, h-8*mm, w, 8*mm, fill=1, stroke=0)
        canvas.setFillColor(BRASS); canvas.rect(0, h-8*mm, 31*mm, 1.2*mm, fill=1, stroke=0)
        canvas.setFont(BOLD, 8); canvas.setFillColor(INK)
        canvas.drawString(doc.leftMargin, 11*mm, "TSOGO-BIS  |  SYSTEM DOCUMENTATION")
        canvas.setFont(FONT, 8); canvas.setFillColor(MUTED)
        canvas.drawRightString(w-doc.rightMargin, 11*mm, f"{DATE}  |  {doc.page}")
        canvas.setStrokeColor(LINE); canvas.line(doc.leftMargin, 14*mm, w-doc.rightMargin, 14*mm)
        canvas.restoreState()


class FlowDiagram(Flowable):
    def __init__(self, labels, width=174*mm, height=62*mm):
        super().__init__(); self.labels, self.width, self.height = labels, width, height
    def wrap(self, aw, ah): return min(self.width, aw), self.height
    def draw(self):
        c, n = self.canv, len(self.labels)
        gap, boxw = 6*mm, (self.width - (n-1)*6*mm)/n
        for i, (title, body) in enumerate(self.labels):
            x, y = i*(boxw+gap), 12*mm
            c.setFillColor(colors.white if i % 2 else PALE); c.setStrokeColor(LINE); c.roundRect(x,y,boxw,34*mm,3*mm,fill=1,stroke=1)
            c.setFillColor(INK); c.setFont(BOLD,8); c.drawCentredString(x+boxw/2,y+25*mm,title)
            c.setFillColor(MUTED); c.setFont(FONT,6.7)
            words, lines, line = body.split(), [], ""
            for word in words:
                trial=(line+" "+word).strip()
                if c.stringWidth(trial,FONT,6.7)>boxw-7*mm: lines.append(line); line=word
                else: line=trial
            if line: lines.append(line)
            for j, text in enumerate(lines[:4]): c.drawCentredString(x+boxw/2,y+17*mm-j*3.2*mm,text)
            if i < n-1:
                ax=x+boxw+1*mm; ay=y+17*mm
                c.setStrokeColor(BRASS); c.setFillColor(BRASS); c.setLineWidth(1.3)
                c.line(ax,ay,ax+4*mm,ay); c.line(ax+4*mm,ay,ax+2.5*mm,ay+1.1*mm); c.line(ax+4*mm,ay,ax+2.5*mm,ay-1.1*mm)


class EntityDiagram(Flowable):
    def __init__(self, width=174*mm, height=100*mm): super().__init__(); self.width=width; self.height=height
    def wrap(self, aw, ah): return min(self.width,aw), self.height
    def draw(self):
        c=self.canv
        boxes={
          "profiles":(3,68,43,19,"profiles\nuser_id PK, language, referral_code"),
          "roles":(3,39,43,19,"user_roles\nuser_id FK, role"),
          "products":(64,68,48,19,"products\ncategory_id FK, stock, price"),
          "catalog":(127,68,45,19,"images / tags\nproduct_id FK"),
          "cart":(64,39,48,19,"cart_items\nuser_id + product_id"),
          "checkout":(64,10,48,19,"checkouts\nuser_id FK, payment, delivery"),
          "lines":(127,39,45,19,"checkout_items\ncheckout_id + product_id"),
          "events":(127,10,45,19,"shipments / events\ncheckout linkage varies"),
          "social":(3,10,43,19,"reviews / referrals\nprofiles + products / orders"),
        }
        for x,y,w,h,label in boxes.values():
            c.setFillColor(PALE); c.setStrokeColor(LINE); c.roundRect(x*mm,y*mm,w*mm,h*mm,2*mm,fill=1,stroke=1)
            c.setFillColor(INK); c.setFont(BOLD,6.5)
            parts=label.split("\n"); c.drawString(x*mm+2*mm,(y+h)*mm-6*mm,parts[0])
            c.setFillColor(MUTED); c.setFont(FONT,5.3); c.drawString(x*mm+2*mm,y*mm+4*mm,parts[1])
        c.setStrokeColor(BRASS); c.setLineWidth(.8)
        links=[((24,68),(24,58)),((112,77),(127,77)),((88,68),(88,58)),((88,39),(88,29)),((46,77),(64,48)),((112,29),(127,48)),((112,19),(127,19))]
        for (x1,y1),(x2,y2) in links: c.line(x1*mm,y1*mm,x2*mm,y2*mm)


def styles():
    base=getSampleStyleSheet()
    return {
      "cover": ParagraphStyle("cover",fontName=BOLD,fontSize=28,leading=32,textColor=INK,spaceAfter=8*mm),
      "subtitle": ParagraphStyle("subtitle",fontName=FONT,fontSize=13,leading=19,textColor=MUTED,spaceAfter=5*mm),
      "h1": ParagraphStyle("h1",fontName=BOLD,fontSize=17,leading=21,textColor=INK,spaceBefore=5*mm,spaceAfter=3*mm,keepWithNext=True),
      "h2": ParagraphStyle("h2",fontName=BOLD,fontSize=11.5,leading=15,textColor=BRASS,spaceBefore=3*mm,spaceAfter=2*mm,keepWithNext=True),
      "body": ParagraphStyle("body",fontName=FONT,fontSize=8.7,leading=13,textColor=colors.HexColor("#34433a"),spaceAfter=2.2*mm),
      "small": ParagraphStyle("small",fontName=FONT,fontSize=7.2,leading=10,textColor=MUTED,spaceAfter=1.5*mm),
      "cell": ParagraphStyle("cell",fontName=FONT,fontSize=7,leading=9,textColor=colors.HexColor("#34433a")),
      "cellb": ParagraphStyle("cellb",fontName=BOLD,fontSize=7,leading=9,textColor=INK),
      "code": ParagraphStyle("code",fontName="Courier",fontSize=6.8,leading=9,textColor=INK,backColor=PALE,borderPadding=5,spaceBefore=2*mm,spaceAfter=2*mm),
      "caption": ParagraphStyle("caption",fontName=FONT,fontSize=7,leading=10,textColor=MUTED,alignment=TA_CENTER,spaceAfter=4*mm),
    }

S=styles()


def P(text, style="body"):
    return Paragraph(text, S[style])


def table(data, widths, header=True, font=7):
    converted=[]
    for ri,row in enumerate(data):
        converted.append([x if isinstance(x, Flowable) else Paragraph(str(x), S["cellb"] if header and ri==0 else S["cell"]) for x in row])
    t=LongTable(converted,colWidths=widths,repeatRows=1 if header else 0,hAlign="LEFT")
    commands=[("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("GRID",(0,0),(-1,-1),.35,LINE)]
    if header: commands += [("BACKGROUND",(0,0),(-1,0),PALE),("TEXTCOLOR",(0,0),(-1,0),INK)]
    for ri in range(1 if header else 0,len(data)):
        if ri%2==0: commands.append(("BACKGROUND",(0,ri),(-1,ri),colors.HexColor("#fbfaf7")))
    t.setStyle(TableStyle(commands)); return t


def bullet(text):
    return P("<font color='#a48762'><b>•</b></font>  "+text)


def build_system_pdf():
    f=OUT/"TSOGO-BIS-System-Guide.pdf"; doc=BrandDoc(str(f),"TSOGO-BIS System Guide")
    story=[Spacer(1,24*mm),P("TSOGO-BIS", "cover"),P("System architecture, data flows, and operations", "subtitle"),P(f"System guide | Prepared {DATE} | Source: local repository snapshot", "small"),Spacer(1,12*mm),P("Purpose", "h1"),P("This guide explains how the storefront, customer and admin dashboards, database, payment providers, delivery updates, and email functions fit together. It is a codebase-level map for developers and operators.")]
    story += [P("Evidence boundary", "h2"),P("The connected Supabase schema endpoint was unavailable during preparation. The database descriptions below were derived from checked-in schema and migration files. They are not a confirmation of the live production schema or deployment status. Files in supabase/migrations are the intended local history; unapplied files may differ from production.")]
    story += [P("1. System at a glance","h1"),P("TSOGO-BIS is a React single-page commerce application. Vite builds static route documents and assets; Vercel serves those documents and applies route rewrites. Supabase supplies Auth, Postgres, REST/RLS, Realtime, and Storage. Edge Functions coordinate payment gateways, account operations, email, and administrative actions."),FlowDiagram([("Customer / admin","Mobile or desktop browser; React interface"),("Vercel","Static assets, route HTML, prerendered SEO pages"),("Supabase","Auth, Postgres, RLS, Realtime, Storage"),("Edge Functions","Trusted checkout, payment, email, admin workflows"),("Providers","Fapshi, Campay, mail delivery")]),P("Figure 1. Main runtime boundaries. The browser never holds service-role credentials.","caption")]
    story += [P("2. Data flow diagrams","h1"),P("Checkout and payment","h2"),FlowDiagram([("Cart","Customer selects items and payment preferences"),("Create checkout","Authenticated Edge Function validates request"),("Database","Atomic RPC validates stock, creates checkout and line items"),("Gateway","Fapshi or Campay initializes payment"),("Webhook / verify","Provider outcome updates payment state")]),P("Figure 2. Checkout sequence. The local source contains both newer checkouts/checkout_items and baseline orders/order_items models; use the checkout path for the Fapshi workflow and verify the live schema before migrating or reconciling records.","caption")]
    story += [P("Delivery status and dashboard notices","h2"),FlowDiagram([("Admin / scanner","Admin status or tracking action"),("Postgres","Checkout / shipment status changes"),("Triggers","Tracking, email queue, notification records"),("Realtime","Authorized row changes are broadcast"),("Dashboards","Admin/customer inbox and order card update")]),P("Figure 3. Status propagation. Realtime is event transport; durable state remains in Postgres.","caption")]
    story += [P("Referral and customer credit","h2"),FlowDiagram([("Referral URL","Visitor receives referrer code"),("Profile / referral","Signup associates invite when supported"),("First paid order","Database trigger evaluates first eligible order"),("Wallet ledger","Credit is recorded idempotently"),("Dashboard","Referrer sees referral and balance")]),P("Figure 4. Referral lifecycle at a conceptual level; verify exact eligibility predicates in the live migration and current database before finance reconciliation.","caption")]
    story += [P("3. Core data model","h1"),P("The baseline schema has catalog, identity, cart, order, payment, shipment, reviews, settings, and currency tables. Later migrations add the checkout transaction model, referral accounting, customer policies, coupons, email jobs, admin tools, and notifications."),EntityDiagram(),P("Figure 5. Simplified entity map. Arrows represent principal relationships; see the Supabase guide for table and column inventory. The initial schema-v2 order model and later checkouts model coexist in source.","caption")]
    story += [P("4. Application surfaces","h1")]
    route_rows=[["Surface","Purpose / key responsibilities"],["Home and shop","Catalog discovery, filters, visual image search, product links, promotions."],["Product details","Options, price and delivery calculations, gallery, cart actions, public reviews."],["Checkout","Customer/address details, payment mode, coupon, fees, payment initiation."],["Orders and tracking","Order lookup, invoice, tracking information and status."],["Customer dashboard","Account, orders, invoice downloads, cart, reviews, referrals, preferences and cookie controls."],["Admin dashboard","Catalog, orders, tracking, users, reviews, referrals, coupons, ads, settings and analytics."],["Auth / reset","Signup, login, admin MFA gate, reset-password flow."],["Policies","Terms, privacy, delivery policies, bilingual content."],["System routes","Vite prerender creates SEO-friendly pages and product metadata at build time; Vercel rewrites route paths to emitted HTML."]]
    story += [table(route_rows,[42*mm,132*mm]),P("5. Security and trust boundaries","h1"),bullet("Public storefront reads published catalog data through restricted Supabase policies; private order data is scoped to the authenticated customer or an authorized admin."),bullet("Administrative access is checked server-side and the source includes an admin MFA/AAL2 gate. Client-side visibility is not the authorization boundary."),bullet("Payment credentials and service-role keys belong in Supabase secrets. Public client environment variables may contain only the anon/publishable key and public URL."),bullet("Webhook endpoints are unauthenticated at the Supabase JWT layer when the provider requires it; they must validate provider signatures or shared-secret credentials inside the function."),bullet("Cookie preferences are saved in the browser. Essential storage is always active; optional analytics and preference storage follow the recorded consent."),P("6. Resilience and lower-bandwidth behavior","h1"),bullet("Route-level code splitting delays checkout, admin and dashboard bundles until navigation instead of downloading every route at first paint."),bullet("Product and catalog imagery should load lazily outside the first viewport and use async decoding. Large originals remain a main cost on 2G; use appropriately sized/compressed source images and a CDN transformation service if enabled."),bullet("External Google font stylesheets were removed from the critical path; platform font fallbacks avoid blocking on a third-party font host."),bullet("The static SEO fallback now includes critical inline styling while the app bundle hydrates. It remains readable while scripts or styles load slowly."),bullet("The app is not guaranteed fully offline. Good 2G behavior still depends on reachable services, image payload size, radio latency and current device memory."),P("7. Build, deploy, and operate","h1"),bullet("Build with npm run build. scripts/prerender.mjs emits static route HTML, product pages/metadata, sitemap.xml, robots.txt, llms.txt and 404.html."),bullet("Run Supabase migrations from the repository in order after reviewing production schema state. Do not assume a local migration has been applied remotely."),bullet("Deploy Edge Function code separately with the Supabase CLI or project deployment pipeline. Confirm the resulting version in the Supabase dashboard."),bullet("After schema changes, validate RLS, indexes, trigger execution, Edge Function secrets, payment callbacks, Realtime subscriptions, and email provider configuration."),P("8. Known source-level caveats","h1"),P("The checked-in reference schema-v2.sql describes the original orders/order_items model, while later migrations add checkouts/checkout_items for the payment flow. The checkout tables are not a simple alias for the original order tables. Before reporting metrics or rebuilding data pipelines, establish which model is authoritative in the connected production project. The Supabase MCP read failed during this documentation run, so no live table inventory, function deployment list, extension inventory, advisor result, or migration ledger could be confirmed."),P("Local docs inventory","h2"),P(f"The source set inspected includes {len(list(MIGRATIONS.glob('*.sql')))} migration files, supabase/schema-v2.sql, supabase/config.toml, supabase/functions, React route components, Vercel rewrites, and the Vite prerender script.")]
    doc.build(story); return f


def build_supabase_pdf():
    f=OUT/"TSOGO-BIS-Supabase-Reference.pdf"; doc=BrandDoc(str(f),"TSOGO-BIS Supabase Reference")
    story=[Spacer(1,24*mm),P("TSOGO-BIS", "cover"),P("Supabase database, security, functions, and operations", "subtitle"),P(f"Supabase reference | Prepared {DATE} | Derived from checked-in schema and migrations", "small"),Spacer(1,12*mm),P("Scope and live-state limitation","h1"),P("This is an inventory of the repository's Supabase definitions, not a live introspection export. The Supabase MCP read-only schema, function, and migration listing calls failed due to a connector transport error during preparation. The production project could not be confirmed. The reference schema, migrations and local Edge Function files are source evidence; they do not prove every object has been deployed."),P("Configured project reference in this workspace: bompysyuamyalbzmubzo. No credentials or secret values are included.","body"),P("1. Supabase surface map","h1"),FlowDiagram([("Browser","Supabase JS, public key, user JWT"),("Data API","PostgREST routes and RLS policies"),("Postgres","Tables, RPCs, triggers, indexes"),("Realtime","Postgres Changes subscriptions"),("Edge Functions","Server-side integrations and service role")]),P("Figure 1. Supabase service boundaries; Auth and Storage are also used by the application.","caption"),P("2. Schema inventory","h1"),P("Schemas present in checked-in SQL: public (Data API-facing), private (internal helper/rate-limit functions and tables), auth/storage/realtime (Supabase-managed services referenced by policies and functions). The inventory below combines schema-v2.sql with later migrations by adding declared columns; review the migration order and actual live catalog for authoritative final types.")]
    table_rows=[["Table","Columns found in source snapshot"]]
    for name, columns in sorted(TABLES.items()):
        desc="; ".join(f"{col} {typ}" for col,typ in columns.items()) or "Column list not parsed from source"
        table_rows.append([f"<b>{escape(name)}</b>",escape(desc)])
    story += [table(table_rows,[45*mm,129*mm]),Spacer(1,4*mm),P("Column types are compact SQL type labels. Primary keys, foreign keys, defaults, checks, RLS and nullable constraints should be verified from the actual migration statements; names ending in _id are not automatically foreign keys.","small")]
    fk_rows=[["Source column","References","Source file"]]
    for (source,col,target,target_col),origin in sorted(FOREIGN_KEYS.items()):
        fk_rows.append([escape(source+"."+col),escape(target+"."+target_col),escape(origin)])
    story += [P("Foreign-key constraints found in source","h2"),table(fk_rows,[62*mm,63*mm,49*mm])]
    story += [P("3. Index inventory","h1"),P("Explicit CREATE INDEX statements found in schema-v2.sql and migrations. PostgreSQL also creates indexes for primary-key and unique constraints; those may not appear in this list." )]
    idx_rows=[["Index","Table","Definition / source"]]
    for name,(table_name,stmt,source) in sorted(INDEXES.items()):
        idx_rows.append([f"<b>{escape(name)}</b>",escape(table_name),escape(stmt)+"<br/><font color='#657168'>"+escape(source)+"</font>"])
    story += [table(idx_rows,[43*mm,30*mm,101*mm])]
    story += [P("4. SQL function inventory","h1"),P("Function names were deduplicated by schema/name across migrations. Several files replace earlier definitions; the latest migration in chronological order defines the intended version. Read the function body and ACL in source before invoking it directly.")]
    fn_rows=[["Function","Latest source migration"]]
    for name,source in sorted(FUNCTIONS.items()): fn_rows.append([escape(name),escape(source)])
    story += [table(fn_rows,[90*mm,84*mm])]
    story += [P("5. Triggers and policies","h1"),P("Triggers created in checked-in SQL. Repeated trigger names are shown once using the last source occurrence; trigger ordering can matter when names are prefixed or explicitly sorted by PostgreSQL.")]
    trigger_rows=[["Trigger","Definition target"]]+[[escape(n),escape(v)] for n,v in sorted(TRIGGERS.items())]
    story += [table(trigger_rows,[60*mm,114*mm]),P(f"Named RLS policies found: {len(POLICIES)}. Policies span catalog, customer-owned rows, checkout/administrative access, storage objects, and feature-specific workflows. Inspect policy predicates directly in migrations and confirm RLS is enabled on every public table before deployment.")]
    policy_rows=[["Policy","Table","Source"]]+[[escape(n),escape(tab),escape(src)] for (n,tab),src in sorted(POLICIES.items())]
    story += [table(policy_rows,[58*mm,50*mm,66*mm])]
    story += [P("6. Edge Functions","h1"),P("Local function folders are listed below. Function availability and deployed versions were not confirmed remotely. JWT verification is set explicitly for some functions in supabase/config.toml; provider callbacks may intentionally disable gateway JWT and must validate provider credentials themselves.")]
    edge_info=[
      ("create-fapshi-order","Creates an authenticated Fapshi checkout; validates request details and calls the atomic checkout RPC before provider initialization."),
      ("fapshi-webhook","Receives Fapshi payment callbacks and reconciles checkout payment outcome; source includes confirmation/referral flows."),
      ("get-fapshi-checkout-status","Returns the current status for a customer checkout after authorization."),
      ("create-campay-order","Initiates a Campay payment order."),
      ("verify-campay-payment","Verifies/polls Campay payment outcome."),
      ("send-order-status-email","Sends localized customer email for order/payment/delivery status changes."),
      ("send-password-reset","Handles password reset email flow and redirect configuration."),
      ("create-account","Creates account-related data through a server-side path."),
      ("manage-admins","Performs privileged administration user/role management; authenticated admin access is required."),
      ("currency-rate","Provides or updates currency conversion-rate data."),
      ("admin-mark-checkout-paid","Administrative/manual checkout payment reconciliation."),
      ("jghjghjgh","Legacy-named local function folder; behavior and deployment intent need owner confirmation."),
    ]
    edge_rows=[["Function","Source-level responsibility"]]+[[escape(n),escape(d)] for n,d in edge_info]
    story += [table(edge_rows,[50*mm,124*mm]),P("Shared TypeScript modules such as functions/_shared/order-confirmation-email.ts are imported helpers, not separately deployed Edge Functions.","small")]
    story += [P("7. Realtime","h1"),P("The checked-in migration adds checkouts, shipments and shipment_events to the supabase_realtime publication and broadcasts delivery updates by tracking-number topic. The local notifications migration adds the notifications table to the publication for per-user dashboard inboxes. Realtime access is filtered by authenticated row visibility; subscriptions do not replace RLS-protected reads."),bullet("The dashboard notifications migration creates order_placed records for admins on checkout insert and order_update records for the customer when payment or delivery state changes."),bullet("The migration must be applied in production before the new NotificationCenter can read/subscribe to notifications."),bullet("Postgres Changes requires publication membership and appropriate table SELECT grants plus row policies; verify the Supabase publication after migration."),P("8. Security, Auth and Storage","h1"),bullet("Auth identities are managed in auth.users. public.profiles stores application profile details; public.user_roles is the source of admin-role membership."),bullet("Admin authorization helpers include role checks and an AAL2/TOTP verification check. Confirm the active policy calls the MFA-aware helper for privileged updates."),bullet("The public schema is exposed to PostgREST. Enable RLS on every exposed table and grant only required table/column privileges. RLS policies scope customer rows by auth.uid()."),bullet("The source defines a public products-images Storage bucket for catalog downloads with a 10 MiB upload limit and JPEG, PNG, WebP, and AVIF MIME types. Authenticated admin-only policies guard insert, update and delete operations."),bullet("Edge Functions may use SUPABASE_SERVICE_ROLE_KEY only in server-side secret configuration; never embed it in VITE_ variables or client bundles.")]
    story += [P("Environment variable names referenced by local Edge Function code","h2")]
    env_rows=[["Variable name","Function folders referencing it"]]
    for name, folders in sorted(EDGE_ENV.items()): env_rows.append([escape(name),escape(", ".join(sorted(folders)))])
    story += [table(env_rows,[64*mm,110*mm]),P("Only names are shown. Values are secrets and are not part of this document.","small"),P("9. Data and transaction flows","h1"),P("Checkout transaction","h2"),FlowDiagram([("Client call","create-fapshi-order with user JWT"),("RPC","create_fapshi_checkout validates cart and locks stock"),("Rows","checkouts + checkout_items"),("Provider","Fapshi/Campay session"),("Result","Webhook updates state, trigger queues email/credit/notice")]),P("Figure 2. Payment lifecycle as described by source. Ensure inventory reservation, cancellation, expiry and payment-finalization triggers match deployed code before relying on stock counts.","caption")]
    story += [P("Database function categories","h2"),bullet("Authorization helpers: is_admin, is_admin_role, and TOTP/AAL2 verification."),bullet("Checkout/payment: atomic checkout create, payment status update, checkout/order synchronization, inventory synchronization, tracking-number generation."),bullet("Tracking: public tracking lookup and admin shipment/status update routines."),bullet("Referrals: code immutability, first-order commission award, failed-payment refund, wallet-credit application and finalization."),bullet("Notifications/email: confirmation job queue and completion, status-email logs, admin order-email log, and dashboard notification triggers."),bullet("Operational/admin RPCs: admin user listing, bulk order delete, password-reset rate-limit consume, checkout status reconciliation."),P("10. Migration and verification checklist","h1"),bullet("Compare remote migration ledger to local supabase/migrations before applying pending files."),bullet("Apply one approved migration set, then verify table columns, constraints, indexes, RLS policies and trigger attachment in SQL Editor."),bullet("Check `supabase_realtime` publication membership for the tables used by the UI."),bullet("Confirm Edge Function deployment names/versions and provider secrets in Supabase Dashboard."),bullet("Run security and performance advisors after schema changes; resolve missing RLS policies and unindexed foreign-key filters."),bullet("Perform end-to-end staging verification for payment success/failure, stock transitions, status emails, admin notifications, customer notices, and read-state updates."),P(f"Source coverage and limitation: This inventory uses schema-v2.sql, {len(list(MIGRATIONS.glob('*.sql')))} migration files, supabase/config.toml and {len([p for p in (ROOT/'supabase'/'functions').glob('*/index.ts')])} local Edge Function entry files. The remote Supabase connector was unavailable; production columns, indexes, publication membership, installed extensions, deployed function versions, migration ledger, and advisor findings remain unverified. Refresh this reference after remote introspection is available.","small")]
    doc.build(story); return f


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    print(build_system_pdf())
    print(build_supabase_pdf())
