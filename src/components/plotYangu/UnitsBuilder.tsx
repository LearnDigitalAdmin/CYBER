import { Plus, Trash2 } from 'lucide-react';
import { UNIT_CONDITIONS, sizesForType, type UnitSpec, type UnitType } from '../../services/Units';

interface UnitsBuilderProps {
  specs: UnitSpec[];
  onChange: (specs: UnitSpec[]) => void;
}

export const newUnitSpec = (unitType: UnitType = 'residential'): UnitSpec => ({
  unitType,
  unitSize: sizesForType(unitType)[0].value,
  count: 1,
  rentAmount: 0,
  depositAmount: 0,
  condition: 'maintained'
});

const inputCls = 'w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent';

export default function UnitsBuilder({ specs, onChange }: UnitsBuilderProps) {
  const update = (i: number, patch: Partial<UnitSpec>) =>
    onChange(specs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const total = specs.reduce((sum, s) => sum + (s.count || 0), 0);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">Units *</label>
      <div className="space-y-3">
        {specs.map((spec, i) => (
          <div key={i} className="border border-gray-700 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select value={spec.unitType} className={inputCls}
                onChange={(e) => update(i, { unitType: e.target.value as UnitType, unitSize: sizesForType(e.target.value as UnitType)[0].value })}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </select>
              <select value={spec.unitSize} className={inputCls}
                onChange={(e) => update(i, { unitSize: e.target.value as UnitSpec['unitSize'] })}>
                {sizesForType(spec.unitType).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-gray-500">How many
                <input type="number" min={1} value={spec.count || ''} className={inputCls}
                  onChange={(e) => update(i, { count: Math.floor(Number(e.target.value)) })} />
              </label>
              <label className="text-xs text-gray-500">Rent (KES)
                <input type="number" min={0} value={spec.rentAmount || ''} className={inputCls}
                  onChange={(e) => update(i, { rentAmount: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-gray-500">Deposit (KES)
                <input type="number" min={0} value={spec.depositAmount || ''} className={inputCls}
                  onChange={(e) => update(i, { depositAmount: Number(e.target.value) })} />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <select value={spec.condition} className={inputCls}
                onChange={(e) => update(i, { condition: e.target.value as UnitSpec['condition'] })}>
                {UNIT_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <button type="button" onClick={() => onChange(specs.filter((_, idx) => idx !== i))}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg" aria-label="Remove unit row">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...specs, newUnitSpec()])}
        className="mt-3 flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300">
        <Plus className="w-4 h-4" /> Add unit type
      </button>
      <p className="text-gray-500 text-xs mt-1">{total} unit{total === 1 ? '' : 's'} will be created</p>
    </div>
  );
}
