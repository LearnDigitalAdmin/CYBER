import { useState } from 'react';
import { Download, FileText, Loader2, CheckCircle } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const FormPage = () => {
  const [numberOfTenants, setNumberOfTenants] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const generateBlankForm = async () => {
    setGenerating(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      const drawField = (page: any, label: string, x: number, y: number, width: number) => {
        page.drawText(label, {
          x,
          y: y + 5,
          size: 10,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        
        page.drawRectangle({
          x: x + 150,
          y,
          width,
          height: 20,
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 1,
        });
      };

      // Page 1: Header, Landlord & Property Details
      let page = pdfDoc.addPage([842, 595]); // A4 Landscape
      let yPos = 545;

      // Header with branding
      page.drawRectangle({
        x: 0,
        y: 545,
        width: 842,
        height: 50,
        color: rgb(0, 0.7, 0.9),
      });
      
      page.drawText('PLOT YANGU', {
        x: 50,
        y: yPos + 20,
        size: 28,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });
      
      page.drawText('Property Registration Form', {
        x: 50,
        y: yPos + 2,
        size: 14,
        font: helveticaFont,
        color: rgb(1, 1, 1),
      });

      // Contact info
      page.drawText('0791286165', {
        x: 620,
        y: yPos + 25,
        size: 11,
        font: helveticaFont,
        color: rgb(1, 1, 1),
      });
      
      page.drawText('info@cogvana.co.ke', {
        x: 620,
        y: yPos + 10,
        size: 11,
        font: helveticaFont,
        color: rgb(1, 1, 1),
      });

      page.drawText('www.cogvana.co.ke', {
        x: 620,
        y: yPos - 5,
        size: 11,
        font: helveticaFont,
        color: rgb(1, 1, 1),
      });

      yPos = 500;

      // Instructions box
      page.drawRectangle({
        x: 40,
        y: yPos - 35,
        width: 762,
        height: 40,
        color: rgb(1, 0.98, 0.9),
        borderColor: rgb(1, 0.84, 0),
        borderWidth: 2,
      });
      
      page.drawText('INSTRUCTIONS: Please fill in ALL fields clearly in BLOCK LETTERS. This form must be', {
        x: 50,
        y: yPos - 15,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      
      page.drawText('submitted to your Plot Yangu agent for property and tenant registration.', {
        x: 50,
        y: yPos - 28,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 60;

      // Landlord/Agent Section
      page.drawRectangle({
        x: 40,
        y: yPos - 5,
        width: 762,
        height: 25,
        color: rgb(0.9, 0.95, 1),
      });
      
      page.drawText('SECTION A: LANDLORD / AGENT INFORMATION', {
        x: 50,
        y: yPos + 5,
        size: 13,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      yPos -= 40;

      drawField(page, 'Full Name:', 50, yPos, 580);
      yPos -= 30;
      drawField(page, 'National ID Number:', 50, yPos, 580);
      yPos -= 30;
      drawField(page, 'Phone Number:', 50, yPos, 280);
      drawField(page, 'Email Address:', 430, yPos, 350);
      yPos -= 30;
      drawField(page, 'Account Type:', 50, yPos, 200);
      
      // Checkboxes for account type
      page.drawRectangle({
        x: 270,
        y: yPos,
        width: 15,
        height: 15,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1.5,
      });
      page.drawText('Landlord', {
        x: 290,
        y: yPos + 3,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      
      page.drawRectangle({
        x: 360,
        y: yPos,
        width: 15,
        height: 15,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1.5,
      });
      page.drawText('Agent', {
        x: 380,
        y: yPos + 3,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 45;

      // Property Section
      page.drawRectangle({
        x: 40,
        y: yPos - 5,
        width: 762,
        height: 25,
        color: rgb(0.9, 1, 0.9),
      });
      
      page.drawText('SECTION B: PROPERTY INFORMATION', {
        x: 50,
        y: yPos + 5,
        size: 13,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      yPos -= 40;

      drawField(page, 'Property Name:', 50, yPos, 580);
      yPos -= 30;
      drawField(page, 'Physical Address:', 50, yPos, 580);
      yPos -= 30;
      drawField(page, 'Maximum Units:', 50, yPos, 150);
      drawField(page, 'Agent Commission (%):', 430, yPos, 150);
      yPos -= 40;
      
      page.drawText('Property Description:', {
        x: 50,
        y: yPos + 5,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      
      page.drawRectangle({
        x: 50,
        y: yPos - 45,
        width: 730,
        height: 50,
        borderColor: rgb(0.5, 0.5, 0.5),
        borderWidth: 1,
      });

      // Footer
      page.drawText(`Plot Yangu © ${new Date().getFullYear()} | Cogvana Technologies | Page 1`, {
        x: 50,
        y: 15,
        size: 9,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      page.drawText('To be filled by authorized agent only:', {
        x: 620,
        y: 15,
        size: 8,
        font: helveticaFont,
        color: rgb(0.6, 0.6, 0.6),
      });
      
      page.drawRectangle({
        x: 620,
        y: 25,
        width: 150,
        height: 20,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 1,
      });

      // Tenant Pages (1 tenant per page for clarity)
      for (let i = 0; i < numberOfTenants; i++) {
        page = pdfDoc.addPage([842, 595]);
        yPos = 545;

        // Header
        page.drawRectangle({
          x: 0,
          y: 545,
          width: 842,
          height: 50,
          color: rgb(0, 0.7, 0.9),
        });
        
        page.drawText('PLOT YANGU - TENANT INFORMATION', {
          x: 50,
          y: yPos + 15,
          size: 18,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });

        yPos = 480;

        // Tenant Section
        page.drawRectangle({
          x: 40,
          y: yPos - 5,
          width: 762,
          height: 30,
          color: rgb(1, 0.95, 0.9),
        });
        
        page.drawText(`SECTION C: TENANT ${i + 1} OF ${numberOfTenants}`, {
          x: 50,
          y: yPos + 7,
          size: 14,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });

        yPos -= 45;

        // Personal Information
        page.drawText('PERSONAL INFORMATION', {
          x: 50,
          y: yPos,
          size: 11,
          font: helveticaBold,
          color: rgb(0.3, 0.3, 0.3),
        });
        
        yPos -= 25;

        drawField(page, 'Full Name:', 50, yPos, 580);
        yPos -= 30;
        drawField(page, 'National ID Number:', 50, yPos, 280);
        drawField(page, 'Unit Number:', 430, yPos, 350);
        yPos -= 30;
        drawField(page, 'Phone Number:', 50, yPos, 280);
        drawField(page, 'Email Address:', 430, yPos, 350);
        yPos -= 40;

        // Financial Information
        page.drawText('FINANCIAL INFORMATION', {
          x: 50,
          y: yPos,
          size: 11,
          font: helveticaBold,
          color: rgb(0.3, 0.3, 0.3),
        });
        
        yPos -= 25;

        drawField(page, 'Monthly Rent (KES):', 50, yPos, 280);
        drawField(page, 'Standing Fees (KES):', 430, yPos, 350);
        yPos -= 30;
        drawField(page, 'Deposit Amount (KES):', 50, yPos, 280);
        drawField(page, 'Water Unit Price (KES):', 430, yPos, 350);
        yPos -= 30;
        drawField(page, 'Power Unit Price (KES):', 50, yPos, 280);
        drawField(page, 'Water Standing Fee (KES):', 430, yPos, 350);
        yPos -= 40;

        // Lease Information
        page.drawText('LEASE INFORMATION', {
          x: 50,
          y: yPos,
          size: 11,
          font: helveticaBold,
          color: rgb(0.3, 0.3, 0.3),
        });
        
        yPos -= 25;

        drawField(page, 'Lease Start Date:', 50, yPos, 280);
        drawField(page, 'Lease End Date:', 430, yPos, 350);
        yPos -= 40;

        // Additional Information
        page.drawText('Additional Notes / Special Instructions:', {
          x: 50,
          y: yPos,
          size: 10,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        
        page.drawRectangle({
          x: 50,
          y: yPos - 60,
          width: 730,
          height: 60,
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 1,
        });

        yPos -= 80;

        // Signature Section
        page.drawRectangle({
          x: 40,
          y: yPos - 60,
          width: 762,
          height: 65,
          color: rgb(0.97, 0.97, 0.97),
        });
        
        page.drawText('TENANT SIGNATURE', {
          x: 50,
          y: yPos - 10,
          size: 10,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        
        page.drawRectangle({
          x: 50,
          y: yPos - 50,
          width: 250,
          height: 35,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });
        
        page.drawText('Date: ____________________', {
          x: 320,
          y: yPos - 25,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });

        page.drawText('LANDLORD/AGENT SIGNATURE', {
          x: 500,
          y: yPos - 10,
          size: 10,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        
        page.drawRectangle({
          x: 500,
          y: yPos - 50,
          width: 250,
          height: 35,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });

        // Footer
        page.drawText(`Plot Yangu © ${new Date().getFullYear()} | Cogvana Technologies | Page ${i + 2}`, {
          x: 50,
          y: 15,
          size: 9,
          font: helveticaFont,
          color: rgb(0.4, 0.4, 0.4),
        });

        page.drawText('For office use only:', {
          x: 650,
          y: 15,
          size: 8,
          font: helveticaFont,
          color: rgb(0.6, 0.6, 0.6),
        });
        
        page.drawRectangle({
          x: 650,
          y: 25,
          width: 120,
          height: 20,
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 1,
        });
      }

      // Final Instructions Page
      page = pdfDoc.addPage([842, 595]);
      yPos = 545;

      page.drawRectangle({
        x: 0,
        y: 545,
        width: 842,
        height: 50,
        color: rgb(0, 0.7, 0.9),
      });
      
      page.drawText('IMPORTANT INFORMATION', {
        x: 50,
        y: yPos + 15,
        size: 18,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      yPos = 480;

      const instructions = [
        'HOW TO USE THIS FORM:',
        '',
        '1. Fill in all sections completely and legibly in BLOCK LETTERS.',
        '',
        '2. Ensure all information is accurate - incorrect details may delay registration.',
        '',
        '3. Attach copies of:',
        '   • Landlord/Agent National ID',
        '   • All tenant National IDs',
        '   • Property ownership documents (if applicable)',
        '',
        '4. Submit completed form to your Plot Yangu agent for processing.',
        '',
        '5. Registration will be completed within 24-48 hours of submission.',
        '',
        '',
        'IMPORTANT NOTES:',
        '',
        '• All rent payments MUST be processed through the M-Pesa payment terminal.',
        '',
        '• Cash transactions are NOT permitted for Plot Yangu properties.',
        '',
        '• Agents may charge up to KES 20 for invoice printing services.',
        '',
        '• Plot Yangu offers a 30-day FREE trial for all new registrations.',
        '',
        '• After trial: Monthly plans from KES 500 - 5,600 based on property size.',
        '',
        '',
        'FOR ASSISTANCE:',
        '',
        '📞 Call: 0791286165',
        '✉ Email: info@cogvana.co.ke',
        '🌐 Visit: cogvana.co.ke',
      ];

      let textY = yPos;
      instructions.forEach(line => {
        const isBold = line.endsWith(':') || line === '';
        const font = isBold ? helveticaBold : helveticaFont;
        
        page.drawText(line, {
          x: 60,
          y: textY,
          size: 11,
          font,
          color: rgb(0, 0, 0),
        });
        textY -= 16;
      });

      page.drawText(`Plot Yangu © ${new Date().getFullYear()} | Cogvana Corporation | Final Page`, {
        x: 50,
        y: 15,
        size: 9,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });

        const pdfBytes = await pdfDoc.save();
        const pdfArrayBuffer = new Uint8Array(pdfBytes);
        const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      //setPdfUrl(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `PlotYangu_Registration_Form_${numberOfTenants}Tenants_${Date.now()}.pdf`;
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block p-3 bg-cyan-500/10 rounded-2xl mb-4">
            <FileText className="w-16 h-16 text-cyan-400" />
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Plot Yangu Registration Form Generator
          </h1>
          <p className="text-gray-400 text-lg">
            Generate a blank form for landlords/agents to fill in property and tenant details
          </p>
        </div>

        {!pdfUrl ? (
          // Form Generator
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 p-8">
            <div className="mb-8">
              <label className="block text-lg font-semibold text-white mb-4">
                How many tenants will be registered?
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={numberOfTenants}
                onChange={(e) => setNumberOfTenants(parseInt(e.target.value) || 1)}
                className="w-full px-6 py-4 bg-gray-900/50 border-2 border-gray-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white text-2xl text-center font-bold"
                placeholder="Enter number"
              />
              <p className="text-gray-500 text-sm mt-3 text-center">
                This will generate a form with fields for {numberOfTenants} tenant{numberOfTenants !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6 mb-8">
              <h3 className="text-cyan-400 font-bold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                What's included in the form:
              </h3>
              <ul className="space-y-2 text-gray-300">
                <li>• Landlord/Agent information section</li>
                <li>• Property details and description</li>
                <li>• Individual tenant information pages</li>
                <li>• Financial details (rent, deposits, fees)</li>
                <li>• Lease period information</li>
                <li>• Signature sections for all parties</li>
                <li>• Instructions and contact information</li>
              </ul>
            </div>

            <button
              onClick={generateBlankForm}
              disabled={generating || numberOfTenants < 1}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {generating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Generating Form...
                </>
              ) : (
                <>
                  <FileText className="w-6 h-6" />
                  Generate Blank Form
                </>
              )}
            </button>
          </div>
        ) : (
          // PDF Preview & Download
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 p-8">
              <div className="text-center mb-6">
                <div className="inline-block p-4 bg-green-500/10 rounded-2xl mb-4">
                  <CheckCircle className="w-16 h-16 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Form Generated Successfully!
                </h2>
                <p className="text-gray-400">
                  Your blank registration form with {numberOfTenants} tenant section{numberOfTenants !== 1 ? 's' : ''} is ready
                </p>
              </div>

              {/* PDF Preview */}
              <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700 mb-6">
                <iframe
                  src={pdfUrl}
                  className="w-full h-[600px]"
                  title="PDF Preview"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 flex items-center justify-center gap-3"
                >
                  <Download className="w-6 h-6" />
                  Download Form
                </button>
                <button
                  onClick={() => {
                    setPdfUrl(null);
                    setNumberOfTenants(1);
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3"
                >
                  Generate New Form
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
              <h3 className="text-yellow-400 font-bold mb-3">Next Steps:</h3>
              <ol className="space-y-2 text-gray-300 list-decimal list-inside">
                <li>Download and print the form</li>
                <li>Give to landlord/agent to fill in all details</li>
                <li>Collect completed form with required documents</li>
                <li>Use the information to create assets, properties, and tenants in the system</li>
              </ol>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Plot Yangu © {new Date().getFullYear()} | Cogvana Technologies</p>
          <p className="mt-2">
            For support: 📞 0791286165 | ✉ info@cogvana.co.ke | 🌐 cogvana.co.ke
          </p>
        </div>
      </div>
    </div>
  );
};

export default FormPage;