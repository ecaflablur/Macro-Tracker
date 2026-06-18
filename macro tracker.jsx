import { useState, useEffect, useRef } from "react";

// ─── Persistent Storage ───────────────────────────────────────────────────────
const STORAGE_KEYS = { foodDB: "macro_food_db", log: "macro_daily_log", goals: "macro_goals" };

async function dbGet(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function dbSet(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

// ─── Default Data ─────────────────────────────────────────────────────────────
const DEFAULT_GOALS = { calories: 2200, protein: 160, fat: 75, fiber: 30 };

const DEFAULT_FOODS = [
  { id: "f1", name: "Chicken Breast (100g)", calories: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0, saturated: 1, mono: 1.2, poly: 0.8 },
  { id: "f2", name: "Brown Rice (1 cup cooked)", calories: 216, protein: 5, fat: 1.8, carbs: 45, fiber: 3.5, saturated: 0.4, mono: 0.6, poly: 0.6 },
  { id: "f3", name: "Large Egg", calories: 78, protein: 6, fat: 5, carbs: 0.6, fiber: 0, saturated: 1.6, mono: 1.9, poly: 0.7 },
  { id: "f4", name: "Avocado (half)", calories: 120, protein: 1.5, fat: 11, carbs: 6, fiber: 5, saturated: 1.5, mono: 7, poly: 1.4 },
  { id: "f5", name: "Whey Protein Scoop", calories: 120, protein: 25, fat: 2, carbs: 3, fiber: 0, saturated: 1, mono: 0.5, poly: 0.3 },
];

const MACRO_FIELDS = [
  { key: "calories", label: "Calories", unit: "kcal", color: "#f59e0b" },
  { key: "protein", label: "Protein", unit: "g", color: "#3b82f6" },
  { key: "carbs", label: "Carbs", unit: "g", color: "#8b5cf6" },
  { key: "fat", label: "Fat", unit: "g", color: "#ef4444" },
  { key: "fiber", label: "Fiber", unit: "g", color: "#10b981" },
  { key: "saturated", label: "Saturated Fat", unit: "g", color: "#f97316" },
  { key: "mono", label: "Mono Fat", unit: "g", color: "#ec4899" },
  { key: "poly", label: "Poly Fat", unit: "g", color: "#06b6d4" },
];

const BAR_MACROS = ["calories", "protein", "fat", "fiber"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genId() { return "i" + Date.now() + Math.random().toString(36).slice(2, 6); }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function sumMacros(entries) {
  return MACRO_FIELDS.reduce((acc, f) => {
    acc[f.key] = entries.reduce((s, e) => s + (parseFloat(e[f.key]) || 0) * (e.qty || 1), 0);
    return acc;
  }, {});
}

// ─── Components ───────────────────────────────────────────────────────────────
function MacroBar({ label, current, goal, color, unit }) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const over = goal > 0 && current > goal;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#94a3b8" }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: over ? "#ef4444" : "#f1f5f9" }}>
          {Math.round(current)}<span style={{ color: "#64748b", fontWeight: 400 }}>/{goal}{unit}</span>
        </span>
      </div>
      <div style={{ background: "#1e2a3a", borderRadius: 6, height: 14, overflow: "hidden", position: "relative" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 6,
          background: over
            ? "linear-gradient(90deg, #ef4444, #f97316)"
            : `linear-gradient(90deg, ${color}cc, ${color})`,
          transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: `0 0 8px ${color}55`
        }} />
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#0f1923", border: "1px solid #1e2a3a", borderRadius: 16,
        width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", padding: 28
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, unit }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>
        {label}{unit ? <span style={{ color: "#475569", fontWeight: 400 }}> ({unit})</span> : ""}
      </label>
      <input
        type="number" min="0" step="0.1" value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", background: "#1e2a3a",
          border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9",
          padding: "9px 12px", fontSize: 14, outline: "none"
        }}
      />
    </div>
  );
}

const BTN = ({ children, onClick, variant = "primary", small }) => {
  const styles = {
    primary: { background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", border: "none" },
    secondary: { background: "#1e2a3a", color: "#94a3b8", border: "1px solid #334155" },
    danger: { background: "transparent", color: "#ef4444", border: "1px solid #ef444455" },
    ghost: { background: "transparent", color: "#64748b", border: "none" },
  };
  return (
    <button onClick={onClick} style={{
      ...styles[variant], borderRadius: 8, padding: small ? "6px 14px" : "10px 20px",
      fontSize: small ? 12 : 14, fontWeight: 700, cursor: "pointer",
      transition: "opacity .15s", letterSpacing: "0.02em"
    }} onMouseEnter={e => e.target.style.opacity = ".82"} onMouseLeave={e => e.target.style.opacity = "1"}>
      {children}
    </button>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function MacroTracker() {
  const [tab, setTab] = useState("today"); // today | foods | goals
  const [foodDB, setFoodDB] = useState([]);
  const [log, setLog] = useState({}); // { "2026-06-17": [{...entry}] }
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [loaded, setLoaded] = useState(false);

  // Modals
  const [showAddFood, setShowAddFood] = useState(false);
  const [showLogFood, setShowLogFood] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [editFood, setEditFood] = useState(null);

  // Food form state
  const [foodForm, setFoodForm] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", saturated: "", mono: "", poly: "" });

  // Load from storage
  useEffect(() => {
    (async () => {
      const [db, lg, gl] = await Promise.all([dbGet(STORAGE_KEYS.foodDB), dbGet(STORAGE_KEYS.log), dbGet(STORAGE_KEYS.goals)]);
      setFoodDB(db || DEFAULT_FOODS);
      setLog(lg || {});
      setGoals(gl || DEFAULT_GOALS);
      setLoaded(true);
    })();
  }, []);

  const saveDB = async (db) => { setFoodDB(db); await dbSet(STORAGE_KEYS.foodDB, db); };
  const saveLog = async (lg) => { setLog(lg); await dbSet(STORAGE_KEYS.log, lg); };
  const saveGoals = async (gl) => { setGoals(gl); await dbSet(STORAGE_KEYS.goals, gl); };

  const todayEntries = log[todayKey()] || [];
  const totals = sumMacros(todayEntries);

  // ── Food Management ──
  const blankForm = () => ({ name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", saturated: "", mono: "", poly: "" });

  const openAddFood = (food = null) => {
    setFoodForm(food ? { ...food } : blankForm());
    setEditFood(food);
    setShowAddFood(true);
  };

  const saveFood = async () => {
    if (!foodForm.name.trim()) return;
    const entry = { ...foodForm, id: editFood?.id || genId() };
    const newDB = editFood ? foodDB.map(f => f.id === editFood.id ? entry : f) : [...foodDB, entry];
    await saveDB(newDB);
    setShowAddFood(false);
  };

  const deleteFood = async (id) => {
    await saveDB(foodDB.filter(f => f.id !== id));
  };

  // ── Log Entry ──
  const [logSearch, setLogSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [qty, setQty] = useState(1);

  const logFood = async () => {
    if (!selectedFood) return;
    const entry = { ...selectedFood, entryId: genId(), qty: parseFloat(qty) || 1, loggedAt: new Date().toISOString() };
    const key = todayKey();
    const updated = { ...log, [key]: [...(log[key] || []), entry] };
    await saveLog(updated);
    setShowLogFood(false);
    setSelectedFood(null);
    setQty(1);
    setLogSearch("");
  };

  const removeEntry = async (entryId) => {
    const key = todayKey();
    const updated = { ...log, [key]: (log[key] || []).filter(e => e.entryId !== entryId) };
    await saveLog(updated);
  };

  // ── Goals ──
  const [goalsForm, setGoalsForm] = useState(DEFAULT_GOALS);
  const openGoals = () => { setGoalsForm({ ...goals }); setShowGoals(true); };
  const saveGoalsForm = async () => { await saveGoals(goalsForm); setShowGoals(false); };

  const filteredFoods = foodDB.filter(f => f.name.toLowerCase().includes(logSearch.toLowerCase()));

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "#080f17", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#3b82f6", fontSize: 16, fontWeight: 700 }}>Loading…</div>
    </div>
  );

  const totalCalText = `${Math.round(totals.calories || 0)} kcal`;

  return (
    <div style={{ minHeight: "100vh", background: "#080f17", color: "#f1f5f9", fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg,#0d1b2a 0%,#080f17 100%)", padding: "24px 20px 0", borderBottom: "1px solid #1e2a3a" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 4 }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, background: "linear-gradient(135deg,#f1f5f9,#94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Macro Tracker
              </h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: totals.calories > goals.calories ? "#ef4444" : "#f59e0b", lineHeight: 1 }}>
                {Math.round(totals.calories || 0)}
              </div>
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>of {goals.calories} kcal</div>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {[["today", "Today"], ["foods", "Food Library"], ["goals", "Goals"]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                flex: 1, background: "none", border: "none", borderBottom: `2px solid ${tab === key ? "#3b82f6" : "transparent"}`,
                color: tab === key ? "#f1f5f9" : "#475569", fontWeight: 700, fontSize: 13,
                padding: "10px 0", cursor: "pointer", transition: "all .2s", letterSpacing: "0.02em"
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── TODAY TAB ── */}
        {tab === "today" && (
          <>
            {/* Bar Charts */}
            <div style={{ background: "#0d1b2a", border: "1px solid #1e2a3a", borderRadius: 16, padding: "22px 24px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>Daily Progress</h3>
                <button onClick={openGoals} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }}>EDIT GOALS</button>
              </div>
              {BAR_MACROS.map(key => {
                const f = MACRO_FIELDS.find(x => x.key === key);
                return <MacroBar key={key} label={f.label} current={totals[key] || 0} goal={goals[key] || 0} color={f.color} unit={f.unit} />;
              })}
            </div>

            {/* Quick Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Carbs", val: totals.carbs, unit: "g", color: "#8b5cf6" },
                { label: "Sat Fat", val: totals.saturated, unit: "g", color: "#f97316" },
                { label: "Mono", val: totals.mono, unit: "g", color: "#ec4899" },
                { label: "Poly", val: totals.poly, unit: "g", color: "#06b6d4" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0d1b2a", border: "1px solid #1e2a3a", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{Math.round((s.val || 0) * 10) / 10}</div>
                  <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "#334155" }}>{s.unit}</div>
                </div>
              ))}
            </div>

            {/* Log Food Button */}
            <div style={{ marginBottom: 20 }}>
              <BTN onClick={() => setShowLogFood(true)}>+ Log Food</BTN>
            </div>

            {/* Today's Entries */}
            {todayEntries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#334155" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🍽️</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>No food logged yet today</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Tap + Log Food to get started</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {todayEntries.map(e => (
                  <div key={e.entryId} style={{ background: "#0d1b2a", border: "1px solid #1e2a3a", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{e.name}</div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {[
                          { l: "cal", v: Math.round((e.calories || 0) * (e.qty || 1)), c: "#f59e0b" },
                          { l: "pro", v: Math.round((e.protein || 0) * (e.qty || 1) * 10) / 10 + "g", c: "#3b82f6" },
                          { l: "carb", v: Math.round((e.carbs || 0) * (e.qty || 1) * 10) / 10 + "g", c: "#8b5cf6" },
                          { l: "fat", v: Math.round((e.fat || 0) * (e.qty || 1) * 10) / 10 + "g", c: "#ef4444" },
                          { l: "fiber", v: Math.round((e.fiber || 0) * (e.qty || 1) * 10) / 10 + "g", c: "#10b981" },
                        ].map(({ l, v, c }) => (
                          <span key={l} style={{ fontSize: 12, color: c, fontWeight: 700 }}>
                            {l}: <span style={{ color: "#94a3b8", fontWeight: 500 }}>{v}</span>
                          </span>
                        ))}
                        {e.qty !== 1 && <span style={{ fontSize: 12, color: "#475569" }}>×{e.qty}</span>}
                      </div>
                    </div>
                    <button onClick={() => removeEntry(e.entryId)} style={{ background: "none", border: "none", color: "#334155", fontSize: 18, cursor: "pointer", padding: "0 0 0 10px", lineHeight: 1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── FOOD LIBRARY TAB ── */}
        {tab === "foods" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Food Library</h2>
              <BTN onClick={() => openAddFood()} small>+ Add Food</BTN>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {foodDB.map(f => (
                <div key={f.id} style={{ background: "#0d1b2a", border: "1px solid #1e2a3a", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{f.name}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <BTN onClick={() => openAddFood(f)} variant="secondary" small>Edit</BTN>
                      <BTN onClick={() => deleteFood(f.id)} variant="danger" small>Del</BTN>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {MACRO_FIELDS.map(mf => (
                      <span key={mf.key} style={{ fontSize: 12, color: mf.color, fontWeight: 700 }}>
                        {mf.label.split(" ")[0]}: <span style={{ color: "#64748b", fontWeight: 400 }}>{f[mf.key] || 0}{mf.unit === "kcal" ? "" : "g"}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {foodDB.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#334155" }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>No foods in library</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Tap + Add Food to create your first entry</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── GOALS TAB ── */}
        {tab === "goals" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Daily Goals</h2>
              <BTN onClick={saveGoalsForm} small>Save</BTN>
            </div>
            <div style={{ background: "#0d1b2a", border: "1px solid #1e2a3a", borderRadius: 16, padding: 22 }}>
              <p style={{ color: "#475569", fontSize: 13, margin: "0 0 20px" }}>Set your daily targets. These appear on the progress bars.</p>
              <NumInput label="Calories" unit="kcal" value={goalsForm.calories} onChange={v => { setGoalsForm(g => ({ ...g, calories: +v })); setGoals(g => ({ ...g, calories: +v })); }} />
              <NumInput label="Protein" unit="g" value={goalsForm.protein} onChange={v => { setGoalsForm(g => ({ ...g, protein: +v })); setGoals(g => ({ ...g, protein: +v })); }} />
              <NumInput label="Fat" unit="g" value={goalsForm.fat} onChange={v => { setGoalsForm(g => ({ ...g, fat: +v })); setGoals(g => ({ ...g, fat: +v })); }} />
              <NumInput label="Fiber" unit="g" value={goalsForm.fiber} onChange={v => { setGoalsForm(g => ({ ...g, fiber: +v })); setGoals(g => ({ ...g, fiber: +v })); }} />
            </div>
          </>
        )}
      </div>

      {/* ── LOG FOOD MODAL ── */}
      {showLogFood && (
        <Modal title="Log Food" onClose={() => { setShowLogFood(false); setSelectedFood(null); setQty(1); setLogSearch(""); }}>
          <input
            value={logSearch}
            onChange={e => setLogSearch(e.target.value)}
            placeholder="Search food library…"
            style={{ width: "100%", boxSizing: "border-box", background: "#1e2a3a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 14 }}
          />
          <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {filteredFoods.map(f => (
              <div key={f.id} onClick={() => setSelectedFood(f)} style={{
                background: selectedFood?.id === f.id ? "#1e3a5f" : "#1e2a3a",
                border: `1px solid ${selectedFood?.id === f.id ? "#3b82f6" : "#334155"}`,
                borderRadius: 10, padding: "12px 14px", cursor: "pointer", transition: "all .15s"
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{f.calories} kcal · {f.protein}g protein · {f.fat}g fat</div>
              </div>
            ))}
            {filteredFoods.length === 0 && <div style={{ color: "#475569", textAlign: "center", padding: 20 }}>No results. Add it to your Food Library first.</div>}
          </div>
          {selectedFood && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>Servings / Quantity</label>
              <input type="number" min="0.1" step="0.1" value={qty} onChange={e => setQty(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", background: "#1e2a3a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", padding: "9px 12px", fontSize: 14, outline: "none" }} />
              <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
                = {Math.round((selectedFood.calories || 0) * (parseFloat(qty) || 1))} kcal · {Math.round((selectedFood.protein || 0) * (parseFloat(qty) || 1) * 10) / 10}g protein
              </div>
            </div>
          )}
          <BTN onClick={logFood}>Add to Today</BTN>
        </Modal>
      )}

      {/* ── ADD/EDIT FOOD MODAL ── */}
      {showAddFood && (
        <Modal title={editFood ? "Edit Food" : "New Food Item"} onClose={() => setShowAddFood(false)}>
          <NumInput label="Name" unit={null} value={foodForm.name} onChange={v => setFoodForm(f => ({ ...f, name: v }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {MACRO_FIELDS.map(mf => (
              <NumInput key={mf.key} label={mf.label} unit={mf.unit} value={foodForm[mf.key]} onChange={v => setFoodForm(f => ({ ...f, [mf.key]: v }))} />
            ))}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
            <BTN onClick={saveFood}>Save Food</BTN>
            <BTN onClick={() => setShowAddFood(false)} variant="secondary">Cancel</BTN>
          </div>
        </Modal>
      )}

      {/* ── GOALS MODAL (from Today tab) ── */}
      {showGoals && (
        <Modal title="Daily Goals" onClose={() => setShowGoals(false)}>
          <NumInput label="Calories" unit="kcal" value={goalsForm.calories} onChange={v => setGoalsForm(g => ({ ...g, calories: +v }))} />
          <NumInput label="Protein" unit="g" value={goalsForm.protein} onChange={v => setGoalsForm(g => ({ ...g, protein: +v }))} />
          <NumInput label="Fat" unit="g" value={goalsForm.fat} onChange={v => setGoalsForm(g => ({ ...g, fat: +v }))} />
          <NumInput label="Fiber" unit="g" value={goalsForm.fiber} onChange={v => setGoalsForm(g => ({ ...g, fiber: +v }))} />
          <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
            <BTN onClick={saveGoalsForm}>Save Goals</BTN>
            <BTN onClick={() => setShowGoals(false)} variant="secondary">Cancel</BTN>
          </div>
        </Modal>
      )}
    </div>
  );
}
