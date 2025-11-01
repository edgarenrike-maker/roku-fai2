import React, { useEffect, useMemo, useState } from "react";

// --------------------------- PWA bootstrap (manifest + SW) -----------------
// This keeps the single-file demo self-contained. In your real project, also add:
//  - public/manifest.json  (display: "standalone", start_url: ".", icons, name/short_name)
//  - public/sw.js          (a minimal service worker that calls skipWaiting()/clients.claim())
//  - index.html            (<link rel="manifest" href="/manifest.json"> and viewport meta)
// We inject the tags here for convenience and register the service worker.
function ensurePWASetup() {
  // <meta name="viewport" content="width=device-width,initial-scale=1"/>
  if (!document.querySelector('meta[name="viewport"]')) {
    const m = document.createElement("meta");
    m.name = "viewport";
    m.content = "width=device-width,initial-scale=1";
    document.head.appendChild(m);
  }
  // <link rel="manifest" href="/manifest.json">
  if (!document.querySelector('link[rel="manifest"]')) {
    const l = document.createElement("link");
    l.rel = "manifest";
    l.href = "/manifest.json"; // place this file in public/
    document.head.appendChild(l);
  }
  // Register service worker at /sw.js if available
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {/* ignore during local preview if missing */});
  }
}

// --------------------------- helpers --------------------------------------
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitizeName(x: string) {
  return (x || "").replace(/[^a-z0-9_-]+/gi, "").slice(0, 40) || "NA";
}

function csvExport(
  rows: Row[],
  meta: Meta,
  all: boolean = false,
  allRows: Row[] = [],
  size: string = "",
  market: string = ""
) {
  const exportData = all ? allRows : rows;
  const head = [
    "model",
    "serial",
    "mfg",
    "insp",
    "overall",
    "section",
    "item",
    "checkpoint",
    "result",
    "notes",
    "jira",
  ];
  const lines: string[] = [head.join(",")];
  const esc = (t: string) => (t || "").replaceAll('"', '""');
  exportData.forEach((r) => {
    lines.push(
      [
        meta.model,
        meta.serial,
        meta.mfg,
        meta.insp,
        meta.overall,
        r.sec,
        r.item,
        '"' + esc(r.cp) + '"',
        r.res || "",
        '"' + esc(r.note || "") + '"',
        r.jira || "",
      ].join(",")
    );
  });
  const fn = `FAI_${sanitizeName(meta.model)}_${sanitizeName(meta.serial)}_${sanitizeName(size)}_${sanitizeName(market)}_${new Date()
    .toISOString()
    .slice(0, 10)}${all ? "_ALL" : ""}.csv`;
  saveBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), fn);
}

// --------------------------- types ----------------------------------------
type Row = {
  id: number;
  sec: string;
  item: string;
  cp: string;
  res?: string;
  jira?: string;
  note?: string;
};

type Meta = {
  model: string;
  serial: string;
  mfg: string;
  insp: string;
  overall: string;
};

type Photo = {
  id: number;
  url: string;
  caption: string;
};

// --------------------------- constants ------------------------------------
const TV_SIZES = ["43in", "50in", "55in", "65in", "75in"];
const MARKETS = ["US", "CA", "MX"];
const COLS = "1.6fr 2.6fr 5fr 0.9fr 1.1fr 1.4fr"; // sec | item | cp | res | jira | notes
const CELL: React.CSSProperties = {
  padding: "6px",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  width: "100%",
  fontSize: "13px",
  boxSizing: "border-box",
};
const HDR: React.CSSProperties = {
  textAlign: "center",
  fontWeight: 600,
  fontSize: "12px",
  background: "#f9fafb",
  padding: "8px 4px",
  borderBottom: "1px solid #e5e7eb",
  position: "sticky",
  top: 0,
  zIndex: 10,
};
const BADGE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: "999px",
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#374151",
  fontSize: "11px",
  fontWeight: 600,
};

function resStyle(res?: string): React.CSSProperties {
  if (res === "PASS") return { backgroundColor: "#d1fae5", color: "#065f46" };
  if (res === "FAIL") return { backgroundColor: "#fee2e2", color: "#7f1d1d" };
  if (res === "CONDITIONAL APPROVAL")
    return { backgroundColor: "#fef9c3", color: "#78350f" };
  if (res === "N/A") return { backgroundColor: "#e5e7eb", color: "#374151" };
  return {};
}

function sectionCounts(items: Row[]) {
  let pass = 0,
    fail = 0,
    na = 0,
    open = 0;
  items.forEach((r) => {
    if (r.res === "PASS" || r.res === "CONDITIONAL APPROVAL") pass++;
    else if (r.res === "FAIL") fail++;
    else if (r.res === "N/A") na++;
    else open++;
  });
  const denom = pass + fail; // exclude N/A and blanks
  return {
    total: items.length,
    pass,
    fail,
    na,
    open,
    pct: denom ? Math.round((pass * 100) / denom) : 0,
  };
}
function overallCounts(rows: Row[]) {
  let pass = 0,
    fail = 0,
    na = 0,
    open = 0;
  rows.forEach((r) => {
    if (r.res === "PASS" || r.res === "CONDITIONAL APPROVAL") pass++;
    else if (r.res === "FAIL") fail++;
    else if (r.res === "N/A") na++;
    else open++;
  });
  const total = rows.length;
  const denom = pass + fail; // exclude N/A and blanks
  return {
    total,
    pass,
    fail,
    na,
    open,
    pct: denom ? Math.round((pass * 100) / denom) : 0,
  };
}

// --------------------------- full checklist (99) ---------------------------
const FULL_CHECKLIST: Row[] = [
  // Packaging and Carton (1–23)
  { sec: "Packaging and Carton", item: "1. Gift box Cosmetic inspection", cp: "Check for dents, scratches, smudges, or misprinted artwork on the gift box." },
  { sec: "Packaging and Carton", item: "2. Gift box pantone color check", cp: "Verify carton color matches Pantone master standard (DeltaE <= 1.0)." },
  { sec: "Packaging and Carton", item: "3. Gift box label and QR code reading", cp: "Ensure labels and QR codes are legible, properly placed, and scannable." },
  { sec: "Packaging and Carton", item: "4. Gift box artwork match with drawing", cp: "Artwork matches latest approved drawing and revision." },
  { sec: "Packaging and Carton", item: "5. Gift box sealing tape well sealed", cp: "Verify tape fully sealed, straight, and not overlapping print areas." },
  { sec: "Packaging and Carton", item: "6. Pack doc is well placed on top foam", cp: "Packing document placed per spec and visible when unboxing." },
  { sec: "Packaging and Carton", item: "7. Straps tight, right location", cp: "Straps tight; correct location; no twisting or missing straps." },
  { sec: "Packaging and Carton", item: "8. Feet bags in place and in good condition", cp: "Feet bags in correct location; no tears or missing components." },
  { sec: "Packaging and Carton", item: "9. Internal straps", cp: "Straps tight; correct location; no twisting or missing straps." },
  { sec: "Packaging and Carton", item: "10. Hexcomb cardboard is installed", cp: "Hexcomb installed securely; no gaps/deformation." },
  { sec: "Packaging and Carton", item: "11. Internal Bag Supports TV unboxing", cp: "Internal bag supports placed and intact; no tears." },
  { sec: "Packaging and Carton", item: "12. Protective cardboard is installed", cp: "Protective cardboard installed; no missing pieces." },
  { sec: "Packaging and Carton", item: "13. Styrofoam inserts no missing /damage (EPS)", cp: "EPS inserts present, undamaged, correct orientation." },
  { sec: "Packaging and Carton", item: "14. TV bag well taped/folded down", cp: "TV bag folded neatly and taped down securely." },
  { sec: "Packaging and Carton", item: "15. correct Belly band P/N and color consistent", cp: "Belly band P/N and color match the approved spec." },
  { sec: "Packaging and Carton", item: "16. Correct pack document assembly order", cp: "Verify appearance, placement, and conformity to drawing/specification." },
  { sec: "Packaging and Carton", item: "17. correct envelop P/N and color", cp: "Envelope color and part number per spec." },
  { sec: "Packaging and Carton", item: "18. correct QSG part number and artwork", cp: "Artwork matches latest approved drawing and revision." },
  { sec: "Packaging and Carton", item: "19. QSG Folding and Placement", cp: "QSG folded per spec; fits flat; orientation per master; no wrinkles/tears." },
  { sec: "Packaging and Carton", item: "20. QSG Content Verification", cp: "Approved rev; correct language/model/content; no outdated info." },
  { sec: "Packaging and Carton", item: "21. PIF part number and artwork", cp: "Artwork matches latest approved drawing and revision." },
  { sec: "Packaging and Carton", item: "22. Audio inserts P/N and artwork", cp: "Artwork matches latest approved drawing and revision." },
  { sec: "Packaging and Carton", item: "23. I love Roku sticker good quality", cp: "Printed cleanly; no fading or peeling." },
  // Accessories (24–27)
  { sec: "Accessories", item: "24. Accessories bag/box no damage", cp: "Accessory box complete and undamaged." },
  { sec: "Accessories", item: "25. use correct remotes", cp: "Confirm correct remote model included and functions." },
  { sec: "Accessories", item: "26. use correct screws", cp: "Ensure correct screw type, length, and quantity used." },
  { sec: "Accessories", item: "27. clamp, USB, power cable good quality", cp: "Plug USB; device detected within 3s; files readable; no port looseness." },
  // Labeling & Regulatory Checks (28–40)
  { sec: "Labeling & Regulatory Checks", item: "28. Serial/Model Label Placement", cp: "Correct SKU/SN/model; within window; strong adhesion (peel test)." },
  { sec: "Labeling & Regulatory Checks", item: "29. ESN Label", cp: "Back‑cover ESN matches on‑screen; barcode scans; no print errors." },
  { sec: "Labeling & Regulatory Checks", item: "30. Barcode Scannability", cp: "All barcodes (SN/MAC/carton) scan first pass." },
  { sec: "Labeling & Regulatory Checks", item: "31. Regulatory/EMI Labels", cp: "Correct regional marks (FCC/UL/NOM/DOE/ENERGY STAR, etc.)." },
  { sec: "Labeling & Regulatory Checks", item: "32. Energy Label (DOE/FTC/NOM-032)", cp: "Rev/design match art; placed correctly; not obstructed." },
  { sec: "Labeling & Regulatory Checks", item: "33. Warning/Caution Labels", cp: "Required warnings present, legible, correctly located." },
  { sec: "Labeling & Regulatory Checks", item: "34. Back Cover Film & Brand", cp: "Correct logo, surface film, alignment." },
  { sec: "Labeling & Regulatory Checks", item: "35. I/O port and label quality", cp: "Port labels printed clearly; match drawing." },
  { sec: "Labeling & Regulatory Checks", item: "36. Labels, energy and rating label", cp: "Placement & legibility; matches gift box & spec." },
  { sec: "Labeling & Regulatory Checks", item: "37. Device label and QR code", cp: "SN/MAC/SKU consistent with carton; scannable." },
  { sec: "Labeling & Regulatory Checks", item: "38. Laser backplate artwork", cp: "Artwork revision & cosmetic quality per drawing." },
  { sec: "Labeling & Regulatory Checks", item: "39. Logo no damage, scratch, discoloration", cp: "Correct color, adhesion, alignment." },
  { sec: "Labeling & Regulatory Checks", item: "40. Regulatory Label Compliant (Back of TV)", cp: "FCC/UL/NOM/DOE compliance; placement & durability." },
  // Mechanical (41–57)
  { sec: "Mechanical", item: "41. Stand good quality (heat sealed)", cp: "Stand strength, weld quality, heat seal integrity." },
  { sec: "Mechanical", item: "42. Feet CMF", cp: "Surface finish, color, texture per BOM." },
  { sec: "Mechanical", item: "43. Feet slide into slots correctly", cp: "Proper fit; alignment & engagement." },
  { sec: "Mechanical", item: "44. Thumbscrews engage smoothly and tighten securely", cp: "Correct thread; no cross‑thread/strip." },
  { sec: "Mechanical", item: "45. Positioning Guide Installed correctly", cp: "Fit & placement; no interference." },
  { sec: "Mechanical", item: "46. Screen/Panel no quality issues", cp: "Flatness; secure mount; no cracks/pressure." },
  { sec: "Mechanical", item: "47. Open Cell tape correctly placed", cp: "Adhesion/positioning; no air/wrinkles." },
  { sec: "Mechanical", item: "48. Protective film on bezels well taped", cp: "Good adhesion & coverage; tab accessible." },
  { sec: "Mechanical", item: "49. Bezel texture and color", cp: "Match golden sample & tooling rev." },
  { sec: "Mechanical", item: "50. DECO Bezel", cp: "Decorative bezel surface, gloss, attachment." },
  { sec: "Mechanical", item: "51. Back cover good quality", cp: "Material integrity; warpage; screw/clip engagement." },
  { sec: "Mechanical", item: "52. Velcro straps attached to back cover", cp: "Strength and proper routing." },
  { sec: "Mechanical", item: "53. Speaker grill no physical damage", cp: "Alignment/integrity; no gaps/deformation." },
  { sec: "Mechanical", item: "54. Power socket good quality", cp: "Secure retention; alignment; electrical fit." },
  { sec: "Mechanical", item: "55. All TV screws without damage", cp: "Correct torque; no stripped/loose screws." },
  { sec: "Mechanical", item: "56. Install feet same size screws for foot fit check", cp: "Correct screw type/torque; fixture alignment." },
  { sec: "Mechanical", item: "57. Overall TV Dimensions (Width x Height x Depth)", cp: "Verify overall assembly vs. box reference." },
  // Functional (58–80)
  { sec: "Functional", item: "58. Boots to App Image", cp: "Boot to Roku home ≤5s; logo/animation OK." },
  { sec: "Functional", item: "59. Correct Brand UI", cp: "Correct skin; layout/colors/icons match build." },
  { sec: "Functional", item: "60. Remote control works (IR/ RF)", cp: "IR+BLE pairing; all keys respond." },
  { sec: "Functional", item: "61. Follow OOBA steps to connect WIFI and test", cp: "2.4G/5G connect OK; update prompt if any." },
  { sec: "Functional", item: "62. check software version", cp: "Build number vs release plan/golden sample." },
  { sec: "Functional", item: "63. Guided Setup Completes", cp: "End‑to‑end OK; no crash/reboot." },
  { sec: "Functional", item: "64. Factory Reset using Reset button", cp: "Hold 10s; boots to OOBE." },
  { sec: "Functional", item: "65. adjusting volume to check sound no quality issues", cp: "Sound clean; no artifacts; mapping OK." },
  { sec: "Functional", item: "66. power on/off no image, sound quality issues", cp: "Cycles smoothly; no flicker/relay click." },
  { sec: "Functional", item: "67. No PSU AC noise issue during power on/standby", cp: "No coil whine/buzz on power/standby." },
  { sec: "Functional", item: "68. No light leakage at dark screen, no shiny spot, bad pixel", cp: "Dark‑room: no edge/back leaks; no bright spots/mura." },
  { sec: "Functional", item: "69. No Light leakage thru back cover gaps", cp: "Dark‑room: no light through back‑cover gaps." },
  { sec: "Functional", item: "70. adjusting brightness, contrast no display quality issues", cp: "Adjustments apply w/o flicker/instability." },
  { sec: "Functional", item: "71. USB/HMDI/IO port functional", cp: "Detect device; pass signal; mech sound." },
  { sec: "Functional", item: "72. TV tunner workable", cp: "Tuner scans & plays OK." },
  { sec: "Functional", item: "73. ALS test auto brightness", cp: "Auto brightness reacts when covering sensor." },
  { sec: "Functional", item: "74. Ensure Wifi MAC Address is 'Roku Inc'", cp: "Wi‑Fi MAC OUI=Roku Inc; unique; 2.4/5G ok." },
  { sec: "Functional", item: "75. Ensure Ethernet MAC Address is 'Roku Inc'", cp: "LAN link; OUI Roku; traffic stable." },
  { sec: "Functional", item: "76. Ensure Bluetooth MAC Address is 'Roku Inc'", cp: "BT MAC OUI Roku; unique." },
  { sec: "Functional", item: "77. Software update to latest Rev. (Customer Mode)", cp: "Updates & reboots to home w/o error." },
  { sec: "Functional", item: "78. Confirm correct default locale (Region)", cp: "Region/locale matches market." },
  { sec: "Functional", item: "79. IR LED color and finish", cp: "IR lens tint & emission OK." },
  { sec: "Functional", item: "80. Speaker Grill (also cosmetic, but functional relevance)", cp: "No rattle/muffling; perforations clean." },
  // Packaging and Carton (CA Products) (81–87)
  { sec: "Packaging and Carton (CA Products)", item: "81. Carton bilingual text (English/French)", cp: "All printed text bilingual per Canadian Act." },
  { sec: "Packaging and Carton (CA Products)", item: "82. Country of Origin labeling", cp: "Made in ___ / Fabriqué en ___ both languages." },
  { sec: "Packaging and Carton (CA Products)", item: "83. Shipping marks bilingual", cp: "Fragile / Ce côté vers le haut, etc. present." },
  { sec: "Packaging and Carton (CA Products)", item: "84. Recycling symbols (Canada)", cp: "Bilingual message; provincial logos if req." },
  { sec: "Packaging and Carton (CA Products)", item: "85. QSG & warranty bilingual content", cp: "Bilingual QSG + warranty leaflet included." },
  { sec: "Packaging and Carton (CA Products)", item: "86. Remote label and packaging bilingual", cp: "Remote/batteries warnings bilingual." },
  { sec: "Packaging and Carton (CA Products)", item: "87. Safety leaflet bilingual", cp: "Safety info bilingual; CDN contact info." },
  // Labeling & Regulatory Checks (CA Products) (88–95)
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "88. Bilingual warning labels", cp: "Rear/PSU/user areas bilingual (CSA C22.2)." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "89. ESN Label (bilingual + typo check)", cp: "Matches on‑screen; scans OK; avoid 'Mode/Modèle l'." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "90. CSA/ULc certification mark", cp: "CSA or cULus on nameplate; not UL‑only." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "91. Industry Canada (ISED) ID labeling", cp: "ISED ID printed & legible; matches docs." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "92. FCC/IC dual compliance label", cp: "Combined FCC + IC statement present." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "93. Electrical rating label (CSA format)", cp: "Bilingual V/A/Hz text e.g., 120 V~ 60 Hz." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "94. Serial & MAC label bilingual phrasing", cp: "Serial Number / Numéro de série; MAC/Adresse." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "95. Legal manufacturer & importer address", cp: "Canadian importer/rep name & address present." },
  // Functional (CA Products) (96–99)
  { sec: "Functional (CA Products)", item: "96. Language selection (English/French)", cp: "Bilingual setup at first boot & system." },
  { sec: "Functional (CA Products)", item: "97. Roku UI translation validation", cp: "Core UI strings correct in fr‑CA." },
  { sec: "Functional (CA Products)", item: "98. Time zone and region/locale setting (Canada)", cp: "Default region Canada; tz auto‑detect OK." },
  { sec: "Functional (CA Products)", item: "99. Streaming app compliance", cp: "CBC/Crave/Global TV present; US‑only not preloaded." },
];

// --------------------------- app ------------------------------------------
export default function App() {
  useEffect(() => { ensurePWASetup(); }, []);

  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [mfg, setMfg] = useState("");
  const [insp, setInsp] = useState("");
  const [overall, setOverall] = useState("PASS");
  const [size, setSize] = useState("55in");
  const [market, setMarket] = useState("US");

  // Master list (never filtered)
  const [allRows, setAllRows] = useState<Row[]>(() =>
    FULL_CHECKLIST.map((r, i) => ({ id: i + 1, sec: r.sec, item: r.item, cp: r.cp, res: "", jira: "", note: "" }))
  );

  // Photos state
  const [photos, setPhotos] = useState<Photo[]>([]);
  function addPhotos(files: FileList | null) {
    if (!files) return;
    const list: Photo[] = [];
    Array.from(files).forEach((f) => {
      const url = URL.createObjectURL(f);
      list.push({ id: Date.now() + Math.random(), url, caption: "" });
    });
    setPhotos((p) => [...p, ...list]);
  }
  function removePhoto(id: number) {
    setPhotos((p) => p.filter((x) => x.id !== id));
  }

  const meta: Meta = { model, serial, mfg, insp, overall };

  // Market filter for view/metrics/export
  const visibleRows = useMemo<Row[]>(() => {
    const isCA = market === "CA";
    return allRows.filter((r) => (isCA ? true : !r.sec.includes("(CA Products)")));
  }, [allRows, market]);

  const oc = useMemo(() => overallCounts(visibleRows), [visibleRows]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const sections = useMemo(() => {
    const arr: { sec: string; items: Row[] }[] = [];
    const idx: Record<string, number> = {};
    visibleRows.forEach((r) => {
      if (idx[r.sec] == null) {
        idx[r.sec] = arr.length;
        arr.push({ sec: r.sec, items: [] });
      }
      arr[idx[r.sec]].items.push(r);
    });
    return arr;
  }, [visibleRows]);

  const toggleSection = (sec: string) => setCollapsed((p) => ({ ...p, [sec]: !p[sec] }));
  const collapseAll = () => {
    const m: Record<string, boolean> = {};
    sections.forEach((s) => (m[s.sec] = true));
    setCollapsed(m);
  };
  const expandAll = () => setCollapsed({});
  const setSectionRes = (sec: string, val: string) =>
    setAllRows((prev) => prev.map((r) => (r.sec === sec ? { ...r, res: val } : r)));
  const clearSectionRes = (sec: string) =>
    setAllRows((prev) => prev.map((r) => (r.sec === sec ? { ...r, res: "" } : r)));

  return (
    <div style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto", fontFamily: "Inter, system-ui, Arial" }}>
      <h1 style={{ fontSize: "18px", fontWeight: 600 }}>Roku FAI – TV Size</h1>

      {/* Header with summary badges */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          border: "1px solid #e5e7eb",
          padding: "12px",
          borderRadius: "10px",
          marginTop: "8px",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px", flex: "1 1 70%" }}>
          <Field label="Model #" v={model} s={setModel} />
          <Field label="Serial" v={serial} s={setSerial} />
          <Field label="Mfg date" v={mfg} s={setMfg} />
          <Field label="Insp date" v={insp} s={setInsp} />
          <div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>Overall</div>
            <select
              style={{ ...CELL, padding: "8px", ...resStyle(overall) }}
              value={overall}
              onChange={(e) => setOverall(e.target.value)}
            >
              <option>PASS</option>
              <option>FAIL</option>
              <option>CONDITIONAL APPROVAL</option>
            </select>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            justifyContent: "flex-end",
            flex: "1 1 30%",
          }}
        >
          <div style={BADGE}>All {oc.total}</div>
          <div style={{ ...BADGE, background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" }}>Pass {oc.pass}</div>
          <div style={{ ...BADGE, background: "#fef2f2", borderColor: "#fecaca", color: "#7f1d1d" }}>Fail {oc.fail}</div>
          <div style={{ ...BADGE, background: "#e5e7eb", borderColor: "#d1d5db", color: "#374151" }}>N/A {oc.na}</div>
          <div style={{ ...BADGE, background: "#fff7ed", borderColor: "#fed7aa", color: "#7c2d12" }}>Open {oc.open}</div>
          <div style={{ ...BADGE, background: "#e0f2fe", borderColor: "#bae6fd", color: "#075985" }}>Overall Pass % {oc.pct}%</div>
        </div>
      </div>

      {/* Size / Market */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: "8px",
          border: "1px solid #e5e7eb",
          padding: "12px",
          borderRadius: "10px",
          marginTop: "8px",
        }}
      >
        <div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>TV size</div>
          <select style={{ ...CELL, padding: "8px" }} value={size} onChange={(e) => setSize(e.target.value)}>
            {TV_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>Market</div>
          <select style={{ ...CELL, padding: "8px" }} value={market} onChange={(e) => setMarket(e.target.value)}>
            {MARKETS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
            {market === "CA"
              ? "Showing: Global + CA-specific items"
              : "Showing: Global items (CA-specific hidden)"}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          marginTop: "8px",
          overflowX: "auto",
          maxHeight: "70vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: COLS, background: "#f9fafb", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={HDR}>category</div>
          <div style={HDR}>item</div>
          <div style={HDR}>what to look for / checkpoint</div>
          <div style={HDR}>res</div>
          <div style={HDR}>jira</div>
          <div style={HDR}>notes</div>
        </div>

        {sections.map((section) => {
          const c = sectionCounts(section.items);
          const isCAsec = section.sec.includes("(CA Products)");
          return (
            <div key={section.sec}>
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px",
                  background: "#eef2ff",
                  borderTop: "1px solid #e5e7eb",
                  position: "sticky",
                  top: 36,
                  zIndex: 3,
                }}
              >
                <button
                  onClick={() => toggleSection(section.sec)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  <span>{collapsed[section.sec] ? "▶" : "▼"}</span>
                  <span>{section.sec}</span>
                  {isCAsec && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        color: "#2563eb",
                        background: "#dbeafe",
                        border: "1px solid #bfdbfe",
                        borderRadius: 6,
                        padding: "2px 6px",
                      }}
                    >
                      CA
                    </span>
                  )}
                </button>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <div style={BADGE}>All {c.total}</div>
                  <div style={{ ...BADGE, background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" }}>Pass {c.pass}</div>
                  <div style={{ ...BADGE, background: "#fef2f2", borderColor: "#fecaca", color: "#7f1d1d" }}>Fail {c.fail}</div>
                  <div style={{ ...BADGE, background: "#e5e7eb", borderColor: "#d1d5db", color: "#374151" }}>N/A {c.na}</div>
                  <div style={{ ...BADGE, background: "#fff7ed", borderColor: "#fed7aa", color: "#7c2d12" }}>Open {c.open}</div>
                  <div style={{ ...BADGE, background: "#e0f2fe", borderColor: "#bae6fd", color: "#075985" }}>Pass % {c.pct}%</div>
                  <button
                    onClick={() => setSectionRes(section.sec, "PASS")}
                    style={{ padding: "4px 8px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#ecfdf5", color: "#065f46", cursor: "pointer" }}
                  >
                    All PASS
                  </button>
                  <button
                    onClick={() => setSectionRes(section.sec, "FAIL")}
                    style={{ padding: "4px 8px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fef2f2", color: "#7f1d1d", cursor: "pointer" }}
                  >
                    All FAIL
                  </button>
                  <button
                    onClick={() => clearSectionRes(section.sec)}
                    style={{ padding: "4px 8px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", color: "#374151", cursor: "pointer" }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {!collapsed[section.sec] &&
                section.items.map((r) => (
                  <div key={r.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: "8px", padding: "8px", borderTop: "1px solid #e5e7eb" }}>
                    <input style={{ ...CELL, background: "#f9fafb", color: "#6b7280" }} value={r.sec} readOnly />
                    <input
                      style={CELL}
                      value={r.item}
                      onChange={(e) =>
                        setAllRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, item: e.target.value } : x)))
                      }
                    />
                    <textarea
                      rows={2}
                      style={{ ...CELL, resize: "vertical", overflow: "hidden", minHeight: "48px" }}
                      value={r.cp}
                      onInput={(e) => {
                        const el = e.target as HTMLTextAreaElement;
                        el.style.height = "auto";
                        el.style.height = el.scrollHeight + "px";
                      }}
                      onChange={(e) =>
                        setAllRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, cp: e.target.value } : x)))
                      }
                    />
                    <select
                      style={{ ...CELL, ...resStyle(r.res) }}
                      value={r.res || ""}
                      onChange={(e) =>
                        setAllRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, res: e.target.value } : x)))
                      }
                    >
                      <option value=""></option>
                      <option>PASS</option>
                      <option>FAIL</option>
                      <option>CONDITIONAL APPROVAL</option>
                      <option>N/A</option>
                    </select>
                    <input
                      style={CELL}
                      value={r.jira || ""}
                      onChange={(e) =>
                        setAllRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, jira: e.target.value } : x)))
                      }
                    />
                    <input
                      style={CELL}
                      value={r.note || ""}
                      onChange={(e) =>
                        setAllRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, note: e.target.value } : x)))
                      }
                    />
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {/* actions */}
      <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
        <button style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px" }} onClick={collapseAll}>
          collapse all
        </button>
        <button style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px" }} onClick={expandAll}>
          expand all
        </button>
        <button
          style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px" }}
          onClick={() =>
            setAllRows(
              FULL_CHECKLIST.map((r, i) => ({ id: i + 1, sec: r.sec, item: r.item, cp: r.cp, res: "", jira: "", note: "" }))
            )
          }
        >
          reload 99 items
        </button>
        <button
          style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px" }}
          onClick={() => csvExport(visibleRows, meta, false, [], size, market)}
        >
          export csv (visible)
        </button>
        <button
          style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px" }}
          onClick={() => csvExport(visibleRows, meta, true, allRows, size, market)}
        >
          export csv (all items)
        </button>
      </div>

      {/* Photos section */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 14 }}>FAI Photos (optional)</h2>
          <span style={{ ...BADGE }}>Total {photos.length}</span>
        </div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => addPhotos(e.target.files)}
          style={{ marginBottom: 8 }}
        />
        {photos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                <img src={p.url} alt="FAI" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6 }} />
                <input
                  style={{ ...CELL, marginTop: 6 }}
                  placeholder="caption / note"
                  value={p.caption}
                  onChange={(e) =>
                    setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)))
                  }
                />
                <button
                  onClick={() => removePhoto(p.id)}
                  style={{ marginTop: 6, width: "100%", padding: "6px 0", border: "1px solid #e5e7eb", borderRadius: 8 }}
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, v, s }: { label: string; v: string; s: (x: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: "12px", color: "#6b7280" }}>{label}</div>
      <input
        style={{ width: "100%", padding: "8px", border: "1px solid #e5e7eb", borderRadius: "8px" }}
        value={v}
        onChange={(e) => s(e.target.value)}
      />
    </div>
  );
}
