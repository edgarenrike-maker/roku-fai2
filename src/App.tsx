import React, { useEffect, useMemo, useState } from "react";

/* ------------------ PDF globals (safe with CDN) ------------------ */
declare global {
  interface Window {
    jspdf?: any; // set by <script src="...jspdf.umd.min.js">
  }
}

/* ------------------ PWA bootstrap ------------------ */
function ensurePWASetup() {
  if (!document.querySelector('meta[name="viewport"]')) {
    const m = document.createElement("meta");
    m.name = "viewport";
    m.content = "width=device-width,initial-scale=1";
    document.head.appendChild(m);
  }

  if (!document.querySelector('link[rel="manifest"]')) {
    const l = document.createElement("link");
    l.rel = "manifest";
    l.href = "/manifest.json";
    document.head.appendChild(l);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore local preview errors */
    });
  }
}

/* ------------------ helpers ------------------ */
function sanitizeName(x: string) {
  return (x || "").replace(/[^a-z0-9_-]+/gi, "").slice(0, 40) || "NA";
}

/* ------------------ types ------------------ */
type Row = {
  id: number;
  sec: string;
  item: string;
  cp: string;
  res?: string;
  jira?: string;
  note?: string;
};

// rows used to seed the app (no id/result fields yet)
type RowSeed = { sec: string; item: string; cp: string };

type Photo = {
  id: number;
  dataUrl: string; // base64 Data URL for PDF export
  caption: string;
};

/* ------------------ constants ------------------ */
const TV_SIZES = [
  "24in",
  "32in",
  "40in",
  "43in",
  "50in",
  "55in",
  "65in",
  "70in",
  "75in",
  "85in",
];
const MARKETS = ["US", "CA", "MX"];
const SECTIONS = [
  "Packaging and Carton",
  "Accessories",
  "Labeling & Regulatory Checks",
  "Mechanical",
  "Functional",
  "Packaging and Carton (CA Products)",
  "Labeling & Regulatory Checks (CA Products)",
  "Functional (CA Products)",
];

const COLS = "1.6fr 2.6fr 5fr 0.9fr 1.1fr 1.4fr";
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
  background: "#f3f0ff", // light purple
  color: "#4c1d95",
  padding: "8px 4px",
  borderBottom: "1px solid #e5e7eb",
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
  const denom = pass + fail;
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
  const denom = pass + fail;
  return {
    total,
    pass,
    fail,
    na,
    open,
    pct: denom ? Math.round((pass * 100) / denom) : 0,
  };
}

/* --------------------------- checklist (99) --------------------------- */
const FULL_CHECKLIST: RowSeed[] = [
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
  { sec: "Accessories", item: "24. Accessories bag/box no damage", cp: "Accessory box complete and undamaged." },
  { sec: "Accessories", item: "25. use correct remotes", cp: "Confirm correct remote model included and functions." },
  { sec: "Accessories", item: "26. use correct screws", cp: "Ensure correct screw type, length, and quantity used." },
  { sec: "Accessories", item: "27. clamp, USB, power cable good quality", cp: "Plug USB; device detected within 3s; files readable; no port looseness." },
  { sec: "Labeling & Regulatory Checks", item: "28. Serial/Model Label Placement", cp: "Correct SKU/SN/model; within window; strong adhesion (peel test)." },
  { sec: "Labeling & Regulatory Checks", item: "29. ESN Label", cp: "Back-cover ESN matches on-screen; barcode scans; no print errors." },
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
  { sec: "Mechanical", item: "41. Stand good quality (heat sealed)", cp: "Stand strength, weld quality, heat seal integrity." },
  { sec: "Mechanical", item: "42. Feet CMF", cp: "Surface finish, color, texture per BOM." },
  { sec: "Mechanical", item: "43. Feet slide into slots correctly", cp: "Proper fit; alignment & engagement." },
  { sec: "Mechanical", item: "44. Thumbscrews engage smoothly and tighten securely", cp: "Correct thread; no cross-thread/strip." },
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
  { sec: "Functional", item: "58. Boots to App Image", cp: "Boot to Roku home ≤5s; logo/animation OK." },
  { sec: "Functional", item: "59. Correct Brand UI", cp: "Correct skin; layout/colors/icons match build." },
  { sec: "Functional", item: "60. Remote control works (IR/ RF)", cp: "IR+BLE pairing; all keys respond." },
  { sec: "Functional", item: "61. Follow OOBA steps to connect WIFI and test", cp: "2.4G/5G connect OK; update prompt if any." },
  { sec: "Functional", item: "62. check software version", cp: "Build number vs release plan/golden sample." },
  { sec: "Functional", item: "63. Guided Setup Completes", cp: "End-to-end OK; no crash/reboot." },
  { sec: "Functional", item: "64. Factory Reset using Reset button", cp: "Hold 10s; boots to OOBE." },
  { sec: "Functional", item: "65. adjusting volume to check sound no quality issues", cp: "Sound clean; no artifacts; mapping OK." },
  { sec: "Functional", item: "66. power on/off no image, sound quality issues", cp: "Cycles smoothly; no flicker/relay click." },
  { sec: "Functional", item: "67. No PSU AC noise issue during power on/standby", cp: "No coil whine/buzz on power/standby." },
  { sec: "Functional", item: "68. No light leakage at dark screen, no shiny spot, bad pixel", cp: "Dark-room: no edge/back leaks; no bright spots/mura." },
  { sec: "Functional", item: "69. No Light leakage thru back cover gaps", cp: "Dark-room: no light through back-cover gaps." },
  { sec: "Functional", item: "70. adjusting brightness, contrast no display quality issues", cp: "Adjustments apply w/o flicker/instability." },
  { sec: "Functional", item: "71. USB/HMDI/IO port functional", cp: "Detect device; pass signal; mech sound." },
  { sec: "Functional", item: "72. TV tunner workable", cp: "Tuner scans & plays OK." },
  { sec: "Functional", item: "73. ALS test auto brightness", cp: "Auto brightness reacts when covering sensor." },
  { sec: "Functional", item: "74. Ensure Wifi MAC Address is 'Roku Inc'", cp: "Wi-Fi MAC OUI=Roku Inc; unique; 2.4/5G ok." },
  { sec: "Functional", item: "75. Ensure Ethernet MAC Address is 'Roku Inc'", cp: "LAN link; OUI Roku; traffic stable." },
  { sec: "Functional", item: "76. Ensure Bluetooth MAC Address is 'Roku Inc'", cp: "BT MAC OUI Roku; unique." },
  { sec: "Functional", item: "77. Software update to latest Rev. (Customer Mode)", cp: "Updates & reboots to home w/o error." },
  { sec: "Functional", item: "78. Confirm correct default locale (Region)", cp: "Region/locale matches market." },
  { sec: "Functional", item: "79. IR LED color and finish", cp: "IR lens tint & emission OK." },
  { sec: "Functional", item: "80. Speaker Grill (also cosmetic, but functional relevance)", cp: "No rattle/muffling; perforations clean." },
  { sec: "Packaging and Carton (CA Products)", item: "81. Carton bilingual text (English/French)", cp: "All printed text bilingual per Canadian Act." },
  { sec: "Packaging and Carton (CA Products)", item: "82. Country of Origin labeling", cp: "Made in ___ / Fabriqué en ___ both languages." },
  { sec: "Packaging and Carton (CA Products)", item: "83. Shipping marks bilingual", cp: "Fragile / Ce côté vers le haut, etc. present." },
  { sec: "Packaging and Carton (CA Products)", item: "84. Recycling symbols (Canada)", cp: "Bilingual message; provincial logos if req." },
  { sec: "Packaging and Carton (CA Products)", item: "85. QSG & warranty bilingual content", cp: "Bilingual QSG + warranty leaflet included." },
  { sec: "Packaging and Carton (CA Products)", item: "86. Remote label and packaging bilingual", cp: "Remote/batteries warnings bilingual." },
  { sec: "Packaging and Carton (CA Products)", item: "87. Safety leaflet bilingual", cp: "Safety info bilingual; CDN contact info." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "88. Bilingual warning labels", cp: "Rear/PSU/user areas bilingual (CSA C22.2)." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "89. ESN Label (bilingual + typo check)", cp: "Matches on-screen; scans OK; avoid 'Mode/Modèle l'." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "90. CSA/ULc certification mark", cp: "CSA or cULus on nameplate; not UL-only." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "91. Industry Canada (ISED) ID labeling", cp: "ISED ID printed & legible; matches docs." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "92. FCC/IC dual compliance label", cp: "Combined FCC + IC statement present." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "93. Electrical rating label (CSA format)", cp: "Bilingual V/A/Hz text e.g., 120 V~ 60 Hz." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "94. Serial & MAC label bilingual phrasing", cp: "Serial Number / Numéro de série; MAC/Adresse." },
  { sec: "Labeling & Regulatory Checks (CA Products)", item: "95. Legal manufacturer & importer address", cp: "Canadian importer/rep name & address present." },
  { sec: "Functional (CA Products)", item: "96. Language selection (English/French)", cp: "Bilingual setup at first boot & system." },
  { sec: "Functional (CA Products)", item: "97. Roku UI translation validation", cp: "Core UI strings correct in fr-CA." },
  { sec: "Functional (CA Products)", item: "98. Time zone and region/locale setting (Canada)", cp: "Default region Canada; tz auto-detect OK." },
  { sec: "Functional (CA Products)", item: "99. Streaming app compliance", cp: "CBC/Crave/Global TV present; US-only not preloaded." },
];

/* ================== MAIN APP ================== */
export default function App() {
  useEffect(() => {
    ensurePWASetup();
  }, []);

  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [mfg, setMfg] = useState("");
  const [insp, setInsp] = useState("");
  const [overall, setOverall] = useState("PASS");
  const [size, setSize] = useState("55in");
  const [market, setMarket] = useState("US");

  const [allRows, setAllRows] = useState<Row[]>(() =>
    FULL_CHECKLIST.map((r, i) => ({
      ...r,
      id: i + 1,
      res: "",
      jira: "",
      note: "",
    }))
  );

  const [photos, setPhotos] = useState<Photo[]>([]);

  // Read photos as base64 Data URLs (better for PDF export)
  async function addPhotos(files: FileList | null) {
    if (!files) return;

    const fileArray = Array.from(files);
    const newPhotos: Photo[] = await Promise.all(
      fileArray.map(
        (file) =>
          new Promise<Photo>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: Date.now() + Math.random(),
                dataUrl: reader.result as string,
                caption: "",
              });
            };
            reader.readAsDataURL(file);
          })
      )
    );

    setPhotos((prev) => [...prev, ...newPhotos]);
  }

  function removePhoto(id: number) {
    setPhotos((p) => p.filter((x) => x.id !== id));
  }

  const visibleRows = useMemo<Row[]>(() => {
    const isCA = market === "CA";
    return allRows.filter((r) =>
      isCA ? true : !r.sec.includes("(CA Products)")
    );
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

  const toggleSection = (sec: string) =>
    setCollapsed((p) => ({ ...p, [sec]: !p[sec] }));
  const collapseAll = () => {
    const m: Record<string, boolean> = {};
    sections.forEach((s) => (m[s.sec] = true));
    setCollapsed(m);
  };
  const expandAll = () => setCollapsed({});

  const setSectionRes = (sec: string, val: string) =>
    setAllRows((prev) =>
      prev.map((r) => (r.sec === sec ? { ...r, res: val } : r))
    );
  const clearSectionRes = (sec: string) =>
    setAllRows((prev) =>
      prev.map((r) => (r.sec === sec ? { ...r, res: "" } : r))
    );

  /* ---------------- PDF Export (table + photos) ---------------- */
    function exportPDF() {
    const ctor = (window as any).jspdf?.jsPDF;
    if (!ctor) {
      alert("PDF engine not loaded. Check the two CDN <script> tags in index.html.");
      return;
    }

    const doc = new ctor({ orientation: "landscape", unit: "pt", format: "a4" });

    // Title
    doc.setFontSize(14);
    doc.setTextColor(76, 29, 149); // Roku purple
    doc.text("Roku FAI Report", 14, 20);

    // Meta line (now includes Overall)
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `Model: ${model || "-"} | Serial: ${serial || "-"} | Mfg: ${mfg || "-"} | ` +
        `Insp: ${insp || "-"} | Size: ${size} | Market: ${market} | Overall: ${
          overall || "-"
        }`,
      14,
      34
    );

    // Optional: big overall status line just under the meta
    if (overall) {
      if (overall === "PASS") {
        doc.setTextColor(6, 95, 70); // green-ish
      } else if (overall === "FAIL") {
        doc.setTextColor(127, 29, 29); // red-ish
      } else {
        doc.setTextColor(120, 53, 15); // amber-ish for CONDITIONAL
      }
      doc.setFontSize(12);
      doc.text(`FAI Overall Result: ${overall}`, 14, 48);
    }

    // Table data
    const tableRows = visibleRows.map((r) => [
      r.sec,
      r.item,
      r.cp,
      r.res || "",
      r.jira || "",
      r.note || "",
    ]);

    (doc as any).autoTable({
      head: [["Category", "Item", "Checkpoint", "Result", "JIRA", "Notes"]],
      body: tableRows,
      startY: overall ? 56 : 42, // push table down a bit if we printed overall line
      styles: { fontSize: 7 },
      headStyles: { fillColor: [76, 29, 149], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    });

    doc.save(`FAI_${sanitizeName(model)}_${sanitizeName(serial)}.pdf`);
  }


  /* ---------------- Add new item ---------------- */
  const [newSec, setNewSec] = useState(SECTIONS[0]);
  const [newItem, setNewItem] = useState("");
  const [newCp, setNewCp] = useState("");

  function addNewRow() {
    if (!newItem.trim() || !newCp.trim())
      return alert("Please fill item & checkpoint");
    const newRow: Row = {
      id: allRows.length + 1,
      sec: newSec,
      item: newItem,
      cp: newCp,
      res: "",
      jira: "",
      note: "",
    };
    setAllRows((prev) => [...prev, newRow]);
    setNewItem("");
    setNewCp("");
    alert(`Added new inspection item under ${newSec}`);
  }

  /* ---------------- Render UI ---------------- */
  return (
    <div
      style={{
        padding: "16px",
        maxWidth: "1200px",
        margin: "0 auto",
        fontFamily: "Inter, system-ui, Arial",
      }}
    >
      <h1 style={{ fontSize: 16, margin: 0 }}>App loaded</h1>

      <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#4c1d95" }}>
        Roku FAI Inspection Checklist
      </h1>

      {/* Header Section */}
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
          background: "#faf5ff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: "8px",
            flex: "1 1 70%",
          }}
        >
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
          <div style={{ ...BADGE, background: "#ecfdf5", color: "#065f46" }}>
            Pass {oc.pass}
          </div>
          <div style={{ ...BADGE, background: "#fef2f2", color: "#7f1d1d" }}>
            Fail {oc.fail}
          </div>
          <div style={{ ...BADGE, background: "#e5e7eb" }}>N/A {oc.na}</div>
          <div style={{ ...BADGE, background: "#fff7ed", color: "#7c2d12" }}>
            Open {oc.open}
          </div>
          <div style={{ ...BADGE, background: "#ede9fe", color: "#4c1d95" }}>
            Pass % {oc.pct}%
          </div>
        </div>
      </div>

      {/* Size & Market */}
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
          <select
            style={{ ...CELL, padding: "8px" }}
            value={size}
            onChange={(e) => setSize(e.target.value)}
          >
            {TV_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>Market</div>
          <select
            style={{ ...CELL, padding: "8px" }}
            value={market}
            onChange={(e) => setMarket(e.target.value)}
          >
            {MARKETS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Checklist container (scrollable) */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          marginTop: "8px",
          maxHeight: "70vh",
          overflowY: "auto",
          overflowX: "auto",
          position: "relative",
        }}
      >
        {/* Sticky column header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            background: "#f3f0ff",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: COLS }}>
            <div style={HDR}>Category</div>
            <div style={HDR}>Item</div>
            <div style={HDR}>Checkpoint</div>
            <div style={HDR}>Result</div>
            <div style={HDR}>JIRA</div>
            <div style={HDR}>Notes</div>
          </div>
        </div>

        {sections.map((section) => {
          const c = sectionCounts(section.items);
          return (
            <div key={section.sec}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#ede9fe",
                  padding: "8px",
                  borderTop: "1px solid #e5e7eb",
                  position: "sticky",
                  top: 36, // just below header row
                  zIndex: 2,
                }}
              >
                <button
                  onClick={() => toggleSection(section.sec)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    color: "#4c1d95",
                  }}
                >
                  {collapsed[section.sec] ? "▶" : "▼"} {section.sec}
                </button>

                <div
                  style={{ display: "flex", gap: "6px", alignItems: "center" }}
                >
                  <div style={BADGE}>All {c.total}</div>
                  <div
                    style={{ ...BADGE, background: "#ecfdf5", color: "#065f46" }}
                  >
                    Pass {c.pass}
                  </div>
                  <div
                    style={{ ...BADGE, background: "#fef2f2", color: "#7f1d1d" }}
                  >
                    Fail {c.fail}
                  </div>
                  <button
                    onClick={() => setSectionRes(section.sec, "PASS")}
                    style={{ ...CELL, padding: "4px 8px", cursor: "pointer" }}
                  >
                    All PASS
                  </button>
                  <button
                    onClick={() => setSectionRes(section.sec, "FAIL")}
                    style={{ ...CELL, padding: "4px 8px", cursor: "pointer" }}
                  >
                    All FAIL
                  </button>
                  <button
                    onClick={() => clearSectionRes(section.sec)}
                    style={{ ...CELL, padding: "4px 8px", cursor: "pointer" }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {!collapsed[section.sec] &&
                section.items.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: COLS,
                      gap: "8px",
                      padding: "8px",
                      borderTop: "1px solid #e5e7eb",
                    }}
                  >
                    <input
                      style={{ ...CELL, background: "#f9fafb" }}
                      value={r.sec}
                      readOnly
                    />
                    <input
                      style={CELL}
                      value={r.item}
                      onChange={(e) =>
                        setAllRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id ? { ...x, item: e.target.value } : x
                          )
                        )
                      }
                    />
                    <textarea
                      style={{ ...CELL, resize: "vertical" }}
                      value={r.cp}
                      onChange={(e) =>
                        setAllRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id ? { ...x, cp: e.target.value } : x
                          )
                        )
                      }
                    />
                    <select
                      style={{ ...CELL, ...resStyle(r.res) }}
                      value={r.res || ""}
                      onChange={(e) =>
                        setAllRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id ? { ...x, res: e.target.value } : x
                          )
                        )
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
                        setAllRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id ? { ...x, jira: e.target.value } : x
                          )
                        )
                      }
                    />
                    <input
                      style={CELL}
                      value={r.note || ""}
                      onChange={(e) =>
                        setAllRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id ? { ...x, note: e.target.value } : x
                          )
                        )
                      }
                    />
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {/* Add new inspection item */}
      <div
        style={{
          marginTop: "10px",
          padding: "10px",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
        }}
      >
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>
          Add New Inspection Item
        </h3>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <select
            style={{ ...CELL, flex: "1" }}
            value={newSec}
            onChange={(e) => setNewSec(e.target.value)}
          >
            {SECTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            style={{ ...CELL, flex: "2" }}
            placeholder="New item name"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <input
            style={{ ...CELL, flex: "3" }}
            placeholder="Checkpoint / what to look for"
            value={newCp}
            onChange={(e) => setNewCp(e.target.value)}
          />
          <button
            style={{ ...CELL, flex: "0.5", cursor: "pointer" }}
            onClick={addNewRow}
          >
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "8px",
          flexWrap: "wrap",
        }}
      >
        <button style={{ ...CELL, padding: "8px 12px" }} onClick={collapseAll}>
          Collapse all
        </button>
        <button style={{ ...CELL, padding: "8px 12px" }} onClick={expandAll}>
          Expand all
        </button>
        <button
          style={{
            ...CELL,
            padding: "8px 12px",
            background: "#f3e8ff",
            color: "#4c1d95",
            cursor: "pointer",
          }}
          onClick={exportPDF}
        >
          Export PDF
        </button>
      </div>

      {/* Photos */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 12,
          marginTop: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 14 }}>FAI Photos</h3>
          <span style={BADGE}>Total {photos.length}</span>
        </div>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => addPhotos(e.target.files)}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
            gap: 10,
            marginTop: 8,
          }}
        >
          {photos.map((p) => (
            <div
              key={p.id}
              style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}
            >
              <img src={p.dataUrl} style={{ width: "100%", borderRadius: 6 }} />
              <input
                style={{ ...CELL, marginTop: 6 }}
                placeholder="Caption"
                value={p.caption}
                onChange={(e) =>
                  setPhotos((prev) =>
                    prev.map((x) =>
                      x.id === p.id ? { ...x, caption: e.target.value } : x
                    )
                  )
                }
              />
              <button
                onClick={() => removePhoto(p.id)}
                style={{ ...CELL, marginTop: 6, cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------ Simple input field ------------------ */
function Field({
  label,
  v,
  s,
}: {
  label: string;
  v: string;
  s: (x: string) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: "12px", color: "#6b7280" }}>{label}</div>
      <input
        style={{ ...CELL, padding: "8px" }}
        value={v}
        onChange={(e) => s(e.target.value)}
      />
    </div>
  );
}



