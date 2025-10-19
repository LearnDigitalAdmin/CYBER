import { useState } from 'react';
import { Download, FileText, Loader2, CheckCircle } from 'lucide-react';
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';

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
      
      // Page dimensions
      const PAGE_WIDTH = 842;
      const PAGE_HEIGHT = 595;
      const MARGIN = 40;
      const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
      
      const drawField = (page: PDFPage, label: string, x: number, y: number, width: number) => {
        page.drawText(label, {
          x,
          y: y + 4,
          size: 10,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        
        page.drawRectangle({
          x: x + 135,
          y,
          width,
          height: 18,
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 1,
        });
      };

      // Page 1: Header, Landlord & Property Details
      let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let yPos = PAGE_HEIGHT - 30;

      // Header with branding
      page.drawRectangle({
        x: 0,
        y: PAGE_HEIGHT - 50,
        width: PAGE_WIDTH,
        height: 50,
        color: rgb(0, 0.7, 0.9),
      });
      
      page.drawText('PLOT YANGU', {
        x: MARGIN,
        y: PAGE_HEIGHT - 25,
        size: 24,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });
      
      page.drawText('Property Registration Form', {
        x: MARGIN,
        y: PAGE_HEIGHT - 42,
        size: 12,
        font: helveticaFont,
        color: rgb(1, 1, 1),
      });

      // Contact info (right aligned)
      const contactX = PAGE_WIDTH - 200;
      page.drawText('0791286165', {
        x: contactX,
        y: PAGE_HEIGHT - 22,
        size: 10,
        font: helveticaFont,
        color: rgb(1, 1, 1),
      });
      
      page.drawText('info@cogvana.co.ke', {
        x: contactX,
        y: PAGE_HEIGHT - 34,
        size: 10,
        font: helveticaFont,
        color: rgb(1, 1, 1),
      });

      page.drawText('www.cogvana.co.ke', {
        x: contactX,
        y: PAGE_HEIGHT - 46,
        size: 10,
        font: helveticaFont,
        color: rgb(1, 1, 1),
      });

      yPos = PAGE_HEIGHT - 70;

      // Instructions box
      page.drawRectangle({
        x: MARGIN,
        y: yPos - 38,
        width: CONTENT_WIDTH,
        height: 38,
        color: rgb(1, 0.98, 0.9),
        borderColor: rgb(1, 0.84, 0),
        borderWidth: 2,
      });
      
      page.drawText('INSTRUCTIONS: Please fill in ALL fields clearly in BLOCK LETTERS. This form must be', {
        x: MARGIN + 10,
        y: yPos - 16,
        size: 9,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      
      page.drawText('submitted to your Plot Yangu agent for property and tenant registration.', {
        x: MARGIN + 10,
        y: yPos - 28,
        size: 9,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 58;

      // Landlord/Agent Section Header
      page.drawRectangle({
        x: MARGIN,
        y: yPos - 22,
        width: CONTENT_WIDTH,
        height: 22,
        color: rgb(0.9, 0.95, 1),
      });
      
      page.drawText('SECTION A: LANDLORD / AGENT INFORMATION', {
        x: MARGIN + 10,
        y: yPos - 15,
        size: 12,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      yPos -= 42;

      // Landlord fields
      drawField(page, 'Full Name:', MARGIN + 10, yPos, CONTENT_WIDTH - 155);
      yPos -= 28;
      drawField(page, 'National ID Number:', MARGIN + 10, yPos, CONTENT_WIDTH - 155);
      yPos -= 28;
      drawField(page, 'Phone Number:', MARGIN + 10, yPos, 195);
      drawField(page, 'Email Address:', 400, yPos, 277);
      yPos -= 28;
      
      page.drawText('Account Type:', {
        x: MARGIN + 10,
        y: yPos + 4,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      
      // Checkboxes for account type
      const checkboxY = yPos;
      page.drawRectangle({
        x: MARGIN + 155,
        y: checkboxY,
        width: 14,
        height: 14,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1.5,
      });
      page.drawText('Landlord', {
        x: MARGIN + 173,
        y: checkboxY + 2,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      
      page.drawRectangle({
        x: MARGIN + 255,
        y: checkboxY,
        width: 14,
        height: 14,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1.5,
      });
      page.drawText('Agent', {
        x: MARGIN + 273,
        y: checkboxY + 2,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 42;

      // Property Section Header
      page.drawRectangle({
        x: MARGIN,
        y: yPos - 22,
        width: CONTENT_WIDTH,
        height: 22,
        color: rgb(0.9, 1, 0.9),
      });
      
      page.drawText('SECTION B: PROPERTY INFORMATION', {
        x: MARGIN + 10,
        y: yPos - 15,
        size: 12,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      yPos -= 42;

      // Property fields
      drawField(page, 'Property Name:', MARGIN + 10, yPos, CONTENT_WIDTH - 155);
      yPos -= 28;
      drawField(page, 'Physical Address:', MARGIN + 10, yPos, CONTENT_WIDTH - 155);
      yPos -= 28;
      drawField(page, 'Maximum Units:', MARGIN + 10, yPos, 150);
      drawField(page, 'Agent Commission (%):', 405, yPos, 150);
      yPos -= 35;
      
      page.drawText('Property Description:', {
        x: MARGIN + 10,
        y: yPos,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      
      page.drawRectangle({
        x: MARGIN + 10,
        y: yPos - 48,
        width: CONTENT_WIDTH - 20,
        height: 45,
        borderColor: rgb(0.5, 0.5, 0.5),
        borderWidth: 1,
      });

      // Footer
      page.drawText(`Plot Yangu © ${new Date().getFullYear()} | Cogvana Corporation | Page 1`, {
        x: MARGIN,
        y: 20,
        size: 8,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      page.drawText('To be filled by authorized agent only:', {
        x: PAGE_WIDTH - 240,
        y: 32,
        size: 7,
        font: helveticaFont,
        color: rgb(0.6, 0.6, 0.6),
      });
      
      page.drawRectangle({
        x: PAGE_WIDTH - 240,
        y: 10,
        width: 200,
        height: 18,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 1,
      });

      // Tenant Pages
      for (let i = 0; i < numberOfTenants; i++) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        yPos = PAGE_HEIGHT - 30;

        // Header
        page.drawRectangle({
          x: 0,
          y: PAGE_HEIGHT - 50,
          width: PAGE_WIDTH,
          height: 50,
          color: rgb(0, 0.7, 0.9),
        });
        
        page.drawText('PLOT YANGU - TENANT INFORMATION', {
          x: MARGIN,
          y: PAGE_HEIGHT - 32,
          size: 18,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });

        yPos = PAGE_HEIGHT - 70;

        // Tenant Section Header
        page.drawRectangle({
          x: MARGIN,
          y: yPos - 25,
          width: CONTENT_WIDTH,
          height: 25,
          color: rgb(1, 0.95, 0.9),
        });
        
        page.drawText(`SECTION C: TENANT ${i + 1} OF ${numberOfTenants}`, {
          x: MARGIN + 10,
          y: yPos - 16,
          size: 13,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });

        yPos -= 45;

        // Personal Information
        page.drawText('PERSONAL INFORMATION', {
          x: MARGIN + 10,
          y: yPos,
          size: 10,
          font: helveticaBold,
          color: rgb(0.3, 0.3, 0.3),
        });
        
        yPos -= 22;

        drawField(page, 'Full Name:', MARGIN + 10, yPos, CONTENT_WIDTH - 155);
        yPos -= 28;
        drawField(page, 'National ID Number:', MARGIN + 10, yPos, 210);
        drawField(page, 'Unit Number:', 400, yPos, 272);
        yPos -= 28;
        drawField(page, 'Phone Number:', MARGIN + 10, yPos, 210);
        drawField(page, 'Email Address:', 400, yPos, 272);
        yPos -= 35;

        // Financial Information
        page.drawText('FINANCIAL INFORMATION', {
          x: MARGIN + 10,
          y: yPos,
          size: 10,
          font: helveticaBold,
          color: rgb(0.3, 0.3, 0.3),
        });
        
        yPos -= 22;

        drawField(page, 'Monthly Rent (KES):', MARGIN + 10, yPos, 210);
        drawField(page, 'Standing Fees (KES):', 400, yPos, 272);
        yPos -= 28;
        drawField(page, 'Deposit Amount (KES):', MARGIN + 10, yPos, 210);
        drawField(page, 'Water Unit Price (KES):', 400, yPos, 272);
        yPos -= 28;
        drawField(page, 'Power Unit Price (KES):', MARGIN + 10, yPos, 210);
        drawField(page, 'Water Standing Fee (KES):', 400, yPos, 272);
        yPos -= 35;

        // Lease Information
        page.drawText('LEASE INFORMATION', {
          x: MARGIN + 10,
          y: yPos,
          size: 10,
          font: helveticaBold,
          color: rgb(0.3, 0.3, 0.3),
        });
        
        yPos -= 22;

        drawField(page, 'Lease Start Date:', MARGIN + 10, yPos, 210);
        drawField(page, 'Lease End Date:', 400, yPos, 272);
        yPos -= 35;

        // Additional Information
        page.drawText('Additional Notes / Special Instructions:', {
          x: MARGIN + 10,
          y: yPos,
          size: 10,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        
        page.drawRectangle({
          x: MARGIN + 10,
          y: yPos - 52,
          width: CONTENT_WIDTH - 20,
          height: 50,
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 1,
        });

        yPos -= 70;

        // Signature Section
        page.drawRectangle({
          x: MARGIN,
          y: yPos - 62,
          width: CONTENT_WIDTH,
          height: 62,
          color: rgb(0.97, 0.97, 0.97),
        });
        
        page.drawText('TENANT SIGNATURE', {
          x: MARGIN + 10,
          y: yPos - 15,
          size: 10,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        
        page.drawRectangle({
          x: MARGIN + 10,
          y: yPos - 52,
          width: 240,
          height: 32,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });
        
        page.drawText('Date: ____________________________________', {
          x: MARGIN + 270,
          y: yPos - 32,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });

        // page.drawText('LANDLORD/AGENT SIGNATURE', {
        //   x: MARGIN + 490,
        //   y: yPos - 15,
        //   size: 10,
        //   font: helveticaBold,
        //   color: rgb(0, 0, 0),
        // });
        
        // page.drawRectangle({
        //   x: MARGIN + 490,
        //   y: yPos - 52,
        //   width: 240,
        //   height: 32,
        //   borderColor: rgb(0, 0, 0),
        //   borderWidth: 1,
        // });

        // Footer
        page.drawText(`Plot Yangu © ${new Date().getFullYear()} | Cogvana Corporation | Page ${i + 2}`, {
          x: MARGIN,
          y: 20,
          size: 8,
          font: helveticaFont,
          color: rgb(0.4, 0.4, 0.4),
        });

        page.drawText('For office use only:', {
          x: PAGE_WIDTH - 180,
          y: 32,
          size: 7,
          font: helveticaFont,
          color: rgb(0.6, 0.6, 0.6),
        });
        
        page.drawRectangle({
          x: PAGE_WIDTH - 180,
          y: 10,
          width: 140,
          height: 18,
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 1,
        });
      }

      // Final Instructions Page
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      yPos = PAGE_HEIGHT - 30;

      page.drawRectangle({
        x: 0,
        y: PAGE_HEIGHT - 50,
        width: PAGE_WIDTH,
        height: 50,
        color: rgb(0, 0.7, 0.9),
      });
      
      page.drawText('IMPORTANT INFORMATION', {
        x: MARGIN,
        y: PAGE_HEIGHT - 32,
        size: 18,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      yPos = PAGE_HEIGHT - 75;

      const instructions = [
        { text: 'HOW TO USE THIS FORM:', bold: true },
        { text: '', bold: false },
        { text: '1. Fill in all sections completely and legibly in BLOCK LETTERS.', bold: false },
        { text: '', bold: false },
        { text: '2. Ensure all information is accurate - incorrect details may delay registration.', bold: false },
        { text: '', bold: false },
        { text: '3. Attach copies of:', bold: false },
        { text: '   • Landlord/Agent National ID', bold: false },
        { text: '   • All tenant National IDs', bold: false },
        { text: '   • Property ownership documents (if applicable)', bold: false },
        { text: '', bold: false },
        { text: '4. Submit completed form to your Plot Yangu agent for processing.', bold: false },
        { text: '', bold: false },
        { text: '5. Registration will be completed within 24-48 hours of submission.', bold: false },
        { text: '', bold: false },
        { text: '', bold: false },
        { text: 'IMPORTANT NOTES:', bold: true },
        { text: '', bold: false },
        { text: '• All rent payments MUST be processed through the M-Pesa payment terminal.', bold: false },
        { text: '', bold: false },
        { text: '• Cash transactions are NOT permitted for Plot Yangu properties.', bold: false },
        { text: '', bold: false },
        { text: '• Agents may charge up to KES 20 for invoice printing services.', bold: false },
        { text: '', bold: false },
        { text: '• Plot Yangu offers a 30-day FREE trial for all new registrations.', bold: false },
        { text: '', bold: false },
        { text: '• After trial: Monthly plans from KES 500 - 5,600 based on property size.', bold: false },
        { text: '', bold: false },
        { text: '', bold: false },
        { text: 'FOR ASSISTANCE:', bold: true },
        { text: '', bold: false },
        { text: ' Call: 0791286165', bold: false },
        { text: ' Email: info@cogvana.co.ke', bold: false },
        { text: ' Visit: cogvana.co.ke', bold: false },
      ];

      let textY = yPos;
      instructions.forEach(line => {
        const font = line.bold ? helveticaBold : helveticaFont;
        
        page.drawText(line.text, {
          x: MARGIN + 20,
          y: textY,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        textY -= 14;
      });

      page.drawText('LANDLORD/AGENT SIGNATURE', {
          x: MARGIN + 490,
          y: yPos - 15,
          size: 10,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        
        page.drawRectangle({
          x: MARGIN + 490,
          y: yPos - 52,
          width: 240,
          height: 32,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });

      page.drawText(`Plot Yangu © ${new Date().getFullYear()} | Cogvana Corporation | Final Page`, {
        x: MARGIN,
        y: 20,
        size: 8,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      const pdfBytes = await pdfDoc.save();
const pdfArrayBuffer = new Uint8Array(pdfBytes);
const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
setPdfUrl(url);

    //   const pdfBytes = await pdfDoc.save();
    //   const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    //   const url = URL.createObjectURL(blob);
    //   setPdfUrl(url);
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
                onChange={(e) => setNumberOfTenants(parseInt(e.target.value))}
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

              <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700 mb-6">
                <iframe
                  src={pdfUrl}
                  className="w-full h-[600px]"
                  title="PDF Preview"
                />
              </div>

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

        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Plot Yangu © {new Date().getFullYear()} | Cogvana Corporation</p>
          <p className="mt-2">
            For support: 📞 0791286165 | ✉ info@cogvana.co.ke | 🌐 cogvana.co.ke
          </p>
        </div>
      </div>
    </div>
  );
};

export default FormPage;