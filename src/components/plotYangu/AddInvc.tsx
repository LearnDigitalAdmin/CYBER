import { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Check, Calculator, Calendar, 
  Zap, Droplets, FileText, X, AlertCircle, Info, Loader2 
} from 'lucide-react';
import { assetsService, type Asset, type Property, type Tenant } from '../../services/Assets';
import { Timestamp, setDoc, doc } from 'firebase/firestore';
import { PaymentSuccessHandler } from '../../services/PaymentsSuccess';


import { db } from '../../services/firebaseService';

interface InvoiceInput {
  propertyId: number;
  tenantId?: string;
  tenantName?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  propertyName?: string;
  //tenant: Tenant;
  userId: string;
  billingMonth: string;
  rentAmount: number;
  standingFees: number;
  waterCurrentReading: number;
  waterPreviousReading: number;
  waterStandingFee: number;
  waterUnitPrice: number;
  includeWaterStanding: boolean;
  powerCurrentReading: number;
  powerPreviousReading: number;
  powerUnitPrice: number;
  includePower: boolean;
  otherCharges: number;
  otherChargesDescription: string;
  dueDate: string;
}

export interface Invoice {
  id: string | number;
  userId?: string;
  localId: number;
  tenantId: number;
  propertyId: number;
  assetId: string;
  billingMonth: string;
  rentAmount: number;
  waterCurrentReading: number;
  waterPreviousReading: number;
  waterStandingFee: number;
  waterUnitPrice: number;
  powerCurrentReading: number;
  powerPreviousReading: number;
  powerUnitPrice: number;
  otherCharges: number;
  otherChargesDescription: string;
  totalAmount: number;
  amountPaid: number;
  arrears: number;
  dueDate: string;
  isPaid: boolean;
  paidDate?: string;
  tenantName?: string;
  propertyName?: string;
  invoiceNumber?: any;
  createdAt?: any;
  updatedAt?: any;
}

interface AddInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
  onSuccess: () => void;
}

const AddInvoiceModal: React.FC<AddInvoiceModalProps> = ({
  isOpen,
  onClose,
  asset,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [property, setProperty] = useState<Property | null>(null);



  const [formData, setFormData] = useState<InvoiceInput>({
    propertyId: 0,
    tenantId: '',
    tenantName: '',
    tenantEmail: '',
    tenantPhone: '',
    propertyName: '',
    userId: asset.id,
    billingMonth: new Date().toISOString().slice(0, 7),
    rentAmount: 0,
    standingFees: 0,
    waterCurrentReading: 0,
    waterPreviousReading: 0,
    waterStandingFee: 0,
    waterUnitPrice: 0,
    includeWaterStanding: false,
    powerCurrentReading: 0,
    powerPreviousReading: 0,
    powerUnitPrice: 0,
    includePower: false,
    otherCharges: 0,
    otherChargesDescription: '',
    dueDate: ''
  });

  const steps = [
    { title: 'Property & Tenant', icon: FileText },
    { title: 'Rent Details', icon: FileText },
    { title: 'Water Billing', icon: Droplets },
    { title: 'Power Billing', icon: Zap },
    { title: 'Other Charges', icon: Calculator },
    { title: 'Summary', icon: Check }
  ];

  useEffect(() => {
    if (isOpen) {
      loadProperties();
      // Set default due date (30 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      setFormData(prev => ({
        ...prev,
        dueDate: dueDate.toISOString().slice(0, 10)
      }));
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.propertyId) {
      loadTenants();
    }
  }, [formData.propertyId]);

  useEffect(() => {
    if (formData.tenantId) {
      loadTenantDetails();
    }
  }, [formData.tenantId]);

  const loadProperties = async () => {
    try {
      const props = await assetsService.getPropertiesByAsset(asset.id);
      setProperties(props);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const loadTenants = async () => {
    if (!formData.propertyId) return;
    
    try {
      const tenantsData = await assetsService.getTenantsByProperty(asset.id, formData.propertyId);
      setTenants(tenantsData);
    } catch (error) {
      console.error('Error loading tenants:', error);
    }
  };

  const loadTenantDetails = async () => {
    if (!formData.tenantId) return;
    
    const tenant = tenants.find(t => t.id === formData.tenantId);
    if (tenant) {
      setFormData(prev => ({
        ...prev,
        rentAmount: tenant.rentAmount,
        standingFees: tenant.standingFees
      }));
    }
  };

  const calculateTotals = () => {
    const waterConsumption = Math.max(0, formData.waterCurrentReading - formData.waterPreviousReading);
    const waterAmount = (waterConsumption * formData.waterUnitPrice) + 
                       (formData.includeWaterStanding ? formData.waterStandingFee : 0);
    
    const powerConsumption = Math.max(0, formData.powerCurrentReading - formData.powerPreviousReading);
    const powerAmount = formData.includePower ? (powerConsumption * formData.powerUnitPrice) : 0;
    
    const totalAmount = formData.rentAmount + waterAmount + powerAmount + formData.otherCharges;
    
    return {
      waterConsumption,
      waterAmount,
      powerConsumption,
      powerAmount,
      totalAmount
    };
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (currentStep) {
      case 0:
        if (!formData.propertyId) newErrors.propertyId = 'Please select a property';
        if (!formData.tenantId) newErrors.tenantId = 'Please select a tenant';
        if (!formData.billingMonth) newErrors.billingMonth = 'Please select billing month';
        break;
      case 1:
        if (formData.rentAmount <= 0) newErrors.rentAmount = 'Rent amount must be greater than 0';
        break;
      case 2:
        if (formData.waterCurrentReading < formData.waterPreviousReading) {
          newErrors.waterCurrentReading = 'Current reading cannot be less than previous reading';
        }
        break;
      case 3:
        if (formData.includePower && formData.powerCurrentReading < formData.powerPreviousReading) {
          newErrors.powerCurrentReading = 'Current reading cannot be less than previous reading';
        }
        break;
      case 4:
        if (formData.otherCharges < 0) newErrors.otherCharges = 'Other charges cannot be negative';
        break;
      case 5:
        if (!formData.dueDate) newErrors.dueDate = 'Please select a due date';
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep() && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateFormData = (field: keyof InvoiceInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSave = async () => {
    if (!validateCurrentStep()) return;
    
    setLoading(true);
    try {
      const totals = calculateTotals();
      
      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}`;
      const id = await assetsService.getNextInvoiceId(asset.id);
      const pdfUrl = await PaymentSuccessHandler.generateAndUploadInvoicePDF(invoiceData, property, asset, invoiceNumber);

      const invoiceData = {
        id,
        invoiceNumber,
        tenantId: formData.tenantId,
        tenantName: formData.tenantName || "",
        tenantEmail: formData.tenantEmail || "",
        tenantPhone: formData.tenantPhone || "",
        propertyId: formData.propertyId,
        propertyName: formData.propertyName || "",
        //userId: formData.userId,
        userId: asset.id,
        localId: Date.now(),
        billingMonth: formData.billingMonth,
        rentAmount: formData.rentAmount,
        waterCurrentReading: formData.waterCurrentReading,
        waterPreviousReading: formData.waterPreviousReading,
        waterStandingFee: formData.includeWaterStanding ? formData.waterStandingFee : 0,
        waterUnitPrice: formData.waterUnitPrice,
        waterAmount: totals.waterAmount,
        powerCurrentReading: formData.includePower ? formData.powerCurrentReading : 0,
        powerPreviousReading: formData.includePower ? formData.powerPreviousReading : 0,
        powerUnitPrice: formData.includePower ? formData.powerUnitPrice : 0,
        powerAmount: totals.powerAmount,
        otherCharges: formData.otherCharges,
        otherChargesDescription: formData.otherChargesDescription,
        totalAmount: totals.totalAmount,
        amountPaid: 0,
        arrears: 0,
        isPaid: false,
        pdfStatus: "pending",
        pdfUrl: "",
        dueDate: formData.dueDate,
        lastModified: new Date().toISOString(),
        lastSyncTime: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      
      // const invoiceData = {
      //   id,
      //   invoiceNumber,
      //   tenantId: formData.tenantId,
      //   propertyId: formData.propertyId,
      //   userId: formData.userId,
      //   localId: id,
      //   billingMonth: formData.billingMonth,
      //   rentAmount: formData.rentAmount,
      //   waterCurrentReading: formData.waterCurrentReading,
      //   waterPreviousReading: formData.waterPreviousReading,
      //   waterStandingFee: formData.includeWaterStanding ? formData.waterStandingFee : 0,
      //   waterUnitPrice: formData.waterUnitPrice,
      //   waterAmount: totals.waterAmount,
      //   powerCurrentReading: formData.includePower ? formData.powerCurrentReading : 0,
      //   powerPreviousReading: formData.includePower ? formData.powerPreviousReading : 0,
      //   powerUnitPrice: formData.includePower ? formData.powerUnitPrice : 0,
      //   powerAmount: totals.powerAmount,
      //   otherCharges: formData.otherCharges,
      //   otherChargesDescription: formData.otherChargesDescription,
      //   totalAmount: totals.totalAmount,
      //   amountPaid: 0,
      //   arrears: 0,
      //   isPaid: false,
      //   dueDate: formData.dueDate,
      //   createdAt: Timestamp.now(),
      //   updatedAt: Timestamp.now()
      // };

      // Save to Firestore
      const invoiceRef = doc(db, "users", formData.userId, "invoices", id.toString());
      await setDoc(invoiceRef, invoiceData);

      onSuccess();
      onClose();
      
      // Reset form
      setCurrentStep(0);
      setFormData({
        propertyId: 0,
        tenantId: '',
        userId: asset.id,
        billingMonth: new Date().toISOString().slice(0, 7),
        rentAmount: 0,
        standingFees: 0,
        waterCurrentReading: 0,
        waterPreviousReading: 0,
        waterStandingFee: 0,
        waterUnitPrice: 0,
        includeWaterStanding: false,
        powerCurrentReading: 0,
        powerPreviousReading: 0,
        powerUnitPrice: 0,
        includePower: false,
        otherCharges: 0,
        otherChargesDescription: '',
        dueDate: ''
      });
    } catch (error) {
      console.error('Error saving invoice:', error);
      setErrors({ general: 'Failed to create invoice. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedProperty = properties.find(p => p.id === formData.propertyId);
  const selectedTenant = tenants.find(t => t.id === formData.tenantId);
  const totals = calculateTotals();

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Property *</label>
              <select
                value={formData.propertyId || ''}
                onChange={(e) => {
                  const selectedId = parseInt(e.target.value);
                  updateFormData('propertyId', selectedId);

                  // Find the full property object
                  const selectedProperty = properties.find(p => p.id === selectedId) || null;
                  setProperty(selectedProperty);

                  // Optionally auto-fill related info into formData
                  if (selectedProperty) {
                    updateFormData('propertyName', selectedProperty.name);
                  }

                  // 🧹 Reset tenant-related selections if property changes
                  updateFormData('tenantId', '');
                  setTenant(null);
                }}
                className={`w-full px-4 py-3 bg-gray-900/50 border ${
                  errors.propertyId ? 'border-red-500' : 'border-gray-700'
                } rounded-lg focus:ring-2 focus:ring-cyan-500 text-white`}
              >
                <option value="">Select a property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>

              {errors.propertyId && (
                <p className="text-red-400 text-sm mt-1">{errors.propertyId}</p>
              )}
            </div>
            {/* <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Property *</label>
              <select
                value={formData.propertyId || ''}
                onChange={(e) => updateFormData('propertyId', parseInt(e.target.value))}
                className={`w-full px-4 py-3 bg-gray-900/50 border ${errors.propertyId ? 'border-red-500' : 'border-gray-700'} rounded-lg focus:ring-2 focus:ring-cyan-500 text-white`}
              >
                <option value="">Select a property</option>
                {properties.map(property => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
              {errors.propertyId && <p className="text-red-400 text-sm mt-1">{errors.propertyId}</p>}
            </div> */}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Tenant *</label>
              <select
                value={formData.tenantId || ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  updateFormData('tenantId', selectedId);

                  // find full tenant object
                  const selectedTenant = tenants.find(t => t.id.toString() === selectedId);
                  setTenant(selectedTenant || null);

                  // optionally also auto-fill tenant info in formData
                  if (selectedTenant) {
                    updateFormData('tenantName', selectedTenant.name);
                    updateFormData('tenantEmail', selectedTenant.email || '');
                    updateFormData('tenantPhone', selectedTenant.phone || '');
                  }
                }}
                disabled={!formData.propertyId}
                className={`w-full px-4 py-3 bg-gray-900/50 border ${
                  errors.tenantId ? 'border-red-500' : 'border-gray-700'
                } rounded-lg focus:ring-2 focus:ring-cyan-500 text-white`}
              >
                <option value="">Select a tenant</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} {tenant.unitNumber && `(Unit ${tenant.unitNumber})`}
                  </option>
                ))}
              </select>

              {errors.tenantId && (
                <p className="text-red-400 text-sm mt-1">{errors.tenantId}</p>
              )}
            </div>

            {/* <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Tenant *</label>
              <select
                value={formData.tenantId || ''}
                onChange={(e) => updateFormData('tenantId', e.target.value)}
                disabled={!formData.propertyId}
                className={`w-full px-4 py-3 bg-gray-900/50 border ${errors.tenantId ? 'border-red-500' : 'border-gray-700'} rounded-lg focus:ring-2 focus:ring-cyan-500 text-white`}
              >
                <option value="">Select a tenant</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} {tenant.unitNumber && `(Unit ${tenant.unitNumber})`}
                  </option>
                ))}
              </select>
              {errors.tenantId && <p className="text-red-400 text-sm mt-1">{errors.tenantId}</p>}
            </div> */}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Billing Month *</label>
              <input
                type="month"
                value={formData.billingMonth}
                onChange={(e) => updateFormData('billingMonth', e.target.value)}
                className={`w-full px-4 py-3 bg-gray-900/50 border ${errors.billingMonth ? 'border-red-500' : 'border-gray-700'} rounded-lg focus:ring-2 focus:ring-cyan-500 text-white`}
              />
              {errors.billingMonth && <p className="text-red-400 text-sm mt-1">{errors.billingMonth}</p>}
            </div>

            {selectedProperty && selectedTenant && (
              <div className="bg-cyan-500/10 p-4 rounded-lg border border-cyan-500/30">
                <h4 className="font-medium text-cyan-400 mb-2">Selected Details</h4>
                <p className="text-cyan-300 text-sm">Property: {selectedProperty.name}</p>
                <p className="text-cyan-300 text-sm">Tenant: {selectedTenant.name}</p>
                <p className="text-cyan-300 text-sm">Month: {new Date(formData.billingMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Monthly Rent *</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500">KES</span>
                <input
                  type="number"
                  value={tenant ? tenant.rentAmount : formData.rentAmount}
                  onChange={(e) => updateFormData('rentAmount', parseFloat(e.target.value) || 0)}
                  className={`w-full pl-14 pr-4 py-3 bg-gray-900/50 border ${errors.rentAmount ? 'border-red-500' : 'border-gray-700'} rounded-lg focus:ring-2 focus:ring-cyan-500 text-white`}
                  placeholder="0.00"
                />
              </div>
              {errors.rentAmount && <p className="text-red-400 text-sm mt-1">{errors.rentAmount}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Standing Fees</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500">KES</span>
                <input
                  type="number"
                  value={formData.standingFees}
                  onChange={(e) => updateFormData('standingFees', parseFloat(e.target.value) || 0)}
                  className="w-full pl-14 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white"
                  placeholder="0.00"
                />
              </div>
            </div>

            {selectedTenant && (
              <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/30">
                <h4 className="font-medium text-emerald-400 mb-2">Tenant Information</h4>
                <p className="text-emerald-300 text-sm">Default Rent: KES {selectedTenant.rentAmount.toLocaleString()}</p>
                <p className="text-emerald-300 text-sm">Standing Fees: KES {selectedTenant.standingFees.toLocaleString()}</p>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Droplets className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-medium text-white">Water Billing</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Previous Reading</label>
                <input
                  type="number"
                  value={formData.waterPreviousReading}
                  onChange={(e) => updateFormData('waterPreviousReading', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Current Reading *</label>
                <input
                  type="number"
                  value={formData.waterCurrentReading}
                  onChange={(e) => updateFormData('waterCurrentReading', parseFloat(e.target.value) || 0)}
                  className={`w-full px-4 py-3 bg-gray-900/50 border ${errors.waterCurrentReading ? 'border-red-500' : 'border-gray-700'} rounded-lg focus:ring-2 focus:ring-cyan-500 text-white`}
                  placeholder="0"
                />
                {errors.waterCurrentReading && <p className="text-red-400 text-sm mt-1">{errors.waterCurrentReading}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Unit Price (KES per unit)</label>
              <input
                type="number"
                step="0.01"
                value={formData.waterUnitPrice}
                onChange={(e) => updateFormData('waterUnitPrice', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white"
                placeholder="0.00"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeWaterStanding"
                checked={formData.includeWaterStanding}
                onChange={(e) => updateFormData('includeWaterStanding', e.target.checked)}
                className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
              />
              <label htmlFor="includeWaterStanding" className="text-sm font-medium text-gray-400">
                Include standing fee
              </label>
            </div>

            {formData.includeWaterStanding && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Standing Fee (KES)</label>
                <input
                  type="number"
                  value={formData.waterStandingFee}
                  onChange={(e) => updateFormData('waterStandingFee', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white"
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
              <h4 className="font-medium text-blue-400 mb-2">Water Bill Calculation</h4>
              <p className="text-blue-300 text-sm">Consumption: {totals.waterConsumption} units</p>
              <p className="text-blue-300 text-sm">Amount: KES {totals.waterAmount.toLocaleString()}</p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-medium text-white">Power Billing</h3>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includePower"
                checked={formData.includePower}
                onChange={(e) => updateFormData('includePower', e.target.checked)}
                className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
              />
              <label htmlFor="includePower" className="text-sm font-medium text-gray-400">
                Include power billing
              </label>
            </div>

            {formData.includePower && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Previous Reading</label>
                    <input
                      type="number"
                      value={formData.powerPreviousReading}
                      onChange={(e) => updateFormData('powerPreviousReading', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Current Reading *</label>
                    <input
                      type="number"
                      value={formData.powerCurrentReading}
                      onChange={(e) => updateFormData('powerCurrentReading', parseFloat(e.target.value) || 0)}
                      className={`w-full px-4 py-3 bg-gray-900/50 border ${errors.powerCurrentReading ? 'border-red-500' : 'border-gray-700'} rounded-lg focus:ring-2 focus:ring-cyan-500 text-white`}
                      placeholder="0"
                    />
                    {errors.powerCurrentReading && <p className="text-red-400 text-sm mt-1">{errors.powerCurrentReading}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Unit Price (KES per kWh) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.powerUnitPrice}
                    onChange={(e) => updateFormData('powerUnitPrice', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white"
                    placeholder="0.00"
                  />
                </div>

                <div className="bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/30">
                  <h4 className="font-medium text-yellow-400 mb-2">Power Bill Calculation</h4>
                  <p className="text-yellow-300 text-sm">Consumption: {totals.powerConsumption} kWh</p>
                  <p className="text-yellow-300 text-sm">Amount: KES {totals.powerAmount.toLocaleString()}</p>
                </div>
              </>
            )}

            {!formData.includePower && (
              <div className="text-center py-8 text-gray-500">
                <Zap className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                <p>Power billing is optional for this invoice</p>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-medium text-white">Other Charges</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Amount (KES)</label>
              <input
                type="number"
                value={formData.otherCharges}
                onChange={(e) => updateFormData('otherCharges', parseFloat(e.target.value) || 0)}
                className={`w-full px-4 py-3 bg-gray-900/50 border ${errors.otherCharges ? 'border-red-500' : 'border-gray-700'} rounded-lg focus:ring-2 focus:ring-cyan-500 text-white`}
                placeholder="0.00"
              />
              {errors.otherCharges && <p className="text-red-400 text-sm mt-1">{errors.otherCharges}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
              <textarea
                value={formData.otherChargesDescription}
                onChange={(e) => updateFormData('otherChargesDescription', e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white resize-none"
                rows={3}
                placeholder="e.g., Late payment fee, Maintenance charge, etc."
              />
            </div>

            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <h4 className="font-medium text-gray-300 mb-2">Common Charges</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Late payment fee', amount: 500 },
                  { label: 'Maintenance charge', amount: 1000 },
                  { label: 'Security fee', amount: 200 },
                  { label: 'Garbage collection', amount: 300 }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      updateFormData('otherCharges', item.amount);
                      updateFormData('otherChargesDescription', item.label);
                    }}
                    className="text-left p-2 text-sm text-gray-400 hover:bg-gray-700 rounded transition-colors"
                  >
                    {item.label} (KES {item.amount})
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Check className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-medium text-white">Invoice Summary</h3>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-700/50 px-4 py-3 border-b border-gray-700">
                <h4 className="font-medium text-white">Invoice Details</h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Property:</span>
                  <span className="font-medium text-white">{selectedProperty?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tenant:</span>
                  <span className="font-medium text-white">{selectedTenant?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Billing Month:</span>
                  <span className="font-medium text-white">
                    {new Date(formData.billingMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-700/50 px-4 py-3 border-b border-gray-700">
                <h4 className="font-medium text-white">Charges Breakdown</h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Monthly Rent:</span>
                  <span className="font-medium text-white">KES {formData.rentAmount.toLocaleString()}</span>
                </div>
                
                {totals.waterAmount > 0 && (
                  <div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Water Bill:</span>
                      <span className="font-medium text-white">KES {totals.waterAmount.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-500 ml-4">
                      {totals.waterConsumption} units @ KES {formData.waterUnitPrice}
                      {formData.includeWaterStanding && ` + KES ${formData.waterStandingFee} standing fee`}
                    </div>
                  </div>
                )}

                {formData.includePower && totals.powerAmount > 0 && (
                  <div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Power Bill:</span>
                      <span className="font-medium text-white">KES {totals.powerAmount.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-500 ml-4">
                      {totals.powerConsumption} kWh @ KES {formData.powerUnitPrice}
                    </div>
                  </div>
                )}

                {formData.otherCharges > 0 && (
                  <div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Other Charges:</span>
                      <span className="font-medium text-white">KES {formData.otherCharges.toLocaleString()}</span>
                    </div>
                    {formData.otherChargesDescription && (
                      <div className="text-xs text-gray-500 ml-4">
                        {formData.otherChargesDescription}
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-gray-700 pt-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-white">Total Amount:</span>
                    <span className="text-cyan-400">KES {totals.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Due Date *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => updateFormData('dueDate', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 bg-gray-900/50 border ${errors.dueDate ? 'border-red-500' : 'border-gray-700'} rounded-lg focus:ring-2 focus:ring-cyan-500 text-white`}
                />
              </div>
              {errors.dueDate && <p className="text-red-400 text-sm mt-1">{errors.dueDate}</p>}
            </div>

            <div className="bg-cyan-500/10 p-4 rounded-lg border border-cyan-500/30">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-cyan-400 mb-1">Ready to Create Invoice</h4>
                  <p className="text-cyan-300 text-sm">
                    Review all details above. Once saved, the invoice will be created for the tenant.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <FileText className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Create Invoice for {asset.name}</h3>
            </div>
            <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    index <= currentStep
                      ? 'bg-cyan-500 text-black'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-1 ${
                      index < currentStep ? 'bg-cyan-500' : 'bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            {steps.map((step, index) => (
              <span key={index} className={index <= currentStep ? 'text-cyan-400' : ''}>
                {step.title}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {errors.general && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{errors.general}</p>
            </div>
          )}
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-700">
          <div className="flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                currentStep === 0
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 bg-cyan-500 text-black px-6 py-2 rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-cyan-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Invoice'
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 bg-cyan-500 text-black px-4 py-2 rounded-lg hover:bg-cyan-400 font-semibold shadow-lg shadow-cyan-500/20"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddInvoiceModal;