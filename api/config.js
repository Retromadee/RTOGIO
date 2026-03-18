export default async function handler(req, res) {
    res.status(200).json({
        brandName: 'rto.GiO',
        currency: '£',
        ibanHolder: 'Emmanuel Anesu Chiwandire',
        iban: process.env.ADMIN_IBAN || 'TR050006400000168060041529',
        usdtAddress: process.env.ADMIN_USDT || 'TXXX0000000000000000000000000000000',
        maxStock: 24,
        adminWhatsapp: process.env.ADMIN_WHATSAPP
    });
}
