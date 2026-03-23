export default async function handler(req, res) {
    res.status(200).json({
        brandName: 'rtro.GIO',
        currency: '£',
        ibanHolder: 'Emmanuel Anesu Chiwandire',
        iban: process.env.ADMIN_IBAN || 'TR050006400000168060041529',
        usdtAddress: process.env.ADMIN_USDT || 'TYSWyS6B5ppMtSRHCWphdp9BEG4f3Qdr6B',
        maxStock: 24,
        adminWhatsapp: process.env.ADMIN_WHATSAPP
    });
}
