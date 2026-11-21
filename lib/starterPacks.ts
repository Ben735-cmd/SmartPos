// Names only, no prices: prices differ by shop and town, so the owner fills those in.
export type StarterPack = { id: string; label: string; emoji: string; items: string[] };

export const STARTER_PACKS: StarterPack[] = [
  {
    id: "grocery",
    label: "Grocery shop / mini supermarket",
    emoji: "🛒",
    items: [
      "Mealie meal 25kg", "Mealie meal 10kg", "Mealie meal 5kg", "Rice 2kg", "Rice 1kg", "Sugar 2kg", "Sugar 1kg",
      "Salt 1kg", "Cooking oil 2L", "Cooking oil 750ml", "Cooking oil 375ml", "Flour 2kg", "Spaghetti 500g",
      "Macaroni 500g", "Bread (white)", "Bread (brown)", "Eggs (tray of 30)", "Eggs (each)", "Kapenta 500g",
      "Dried fish", "Beans 1kg", "Groundnuts 500g", "Tomatoes (heap)", "Onions (heap)", "Potatoes (heap)",
      "Cabbage", "Rape / vegetables (bundle)", "Tomato paste", "Margarine 500g", "Peanut butter 380g",
      "Tea bags (box)", "Coffee 100g", "Milk 1L", "Fresh milk 500ml", "Maheu 500ml", "Coca-Cola 300ml",
      "Fanta 300ml", "Sprite 300ml", "Juice 1L", "Bottled water 500ml", "Bottled water 1.5L", "Biscuits (pack)",
      "Sweets (each)", "Chips / snacks (pack)", "Bath soap", "Washing powder 1kg", "Laundry soap bar",
      "Dish washing liquid", "Toilet paper (roll)", "Toothpaste", "Toothbrush", "Body lotion", "Vaseline",
      "Candles (pack)", "Matches (box)", "Charcoal (bag)", "Airtime (K10)", "Airtime (K20)", "Airtime (K50)",
    ],
  },
  {
    id: "hardware",
    label: "Hardware store",
    emoji: "🔧",
    items: [
      "Cement 50kg", "River sand (wheelbarrow)", "Building sand (bag)", "Quarry stones (bag)", "Roofing nails 1kg",
      "Wire nails 2 inch 1kg", "Wire nails 3 inch 1kg", "Wire nails 4 inch 1kg", "Binding wire 1kg",
      "Roofing sheet (IBR)", "Timber 2x2", "Timber 2x4", "Plywood sheet", "Paint 5L (white)", "Paint 20L (white)",
      "Paint brush 2 inch", "Paint brush 4 inch", "Padlock", "Door lock", "Door hinges (pair)", "Door handle",
      "Hammer", "Handsaw", "Screwdriver set", "Tape measure 5m", "Spade", "Shovel", "Wheelbarrow",
      "Pick axe", "Bucket 20L", "PVC pipe 20mm", "PVC pipe 50mm", "Tap", "Light bulb", "Electrical cable 2.5mm (per m)",
      "Extension cord", "Plug (13A)", "Switch", "Socket",
    ],
  },
  {
    id: "pharmacy",
    label: "Pharmacy (over the counter)",
    emoji: "💊",
    items: [
      "Paracetamol 500mg (strip)", "Ibuprofen 200mg (strip)", "Aspirin (strip)", "Cough syrup", "Throat lozenges",
      "Oral rehydration salts (sachet)", "Antacid tablets", "Vitamin C (tube)", "Multivitamin (tub)",
      "Zinc tablets", "Antiseptic liquid", "Plasters (box)", "Bandage roll", "Cotton wool", "Surgical gloves (box)",
      "Face masks (box)", "Hand sanitiser 100ml", "Hand sanitiser 500ml", "Thermometer", "Condoms (pack)",
      "Sanitary pads (pack)", "Baby diapers (pack)", "Baby wipes", "Body lotion", "Petroleum jelly", "Sunscreen",
      "Mosquito repellent", "Insecticide spray", "Toothpaste", "Mouthwash",
    ],
  },
  {
    id: "clothing",
    label: "Clothing store",
    emoji: "👕",
    items: [
      "T-shirt (men)", "T-shirt (women)", "T-shirt (kids)", "Polo shirt", "Jeans (men)", "Jeans (women)",
      "Chitenge (2 metres)", "Chitenge (6 yards)", "Dress", "Skirt", "Shorts", "Track suit", "School uniform shirt",
      "School uniform trousers", "School uniform skirt", "Jacket", "Hoodie", "Socks (pair)", "Underwear (pack)",
      "Belt", "Cap", "Sandals", "Sneakers", "School shoes", "Handbag", "Backpack",
    ],
  },
  {
    id: "restaurant",
    label: "Restaurant / takeaway",
    emoji: "🍽️",
    items: [
      "Nshima with chicken", "Nshima with beef", "Nshima with fish", "Nshima with kapenta", "Nshima with vegetables",
      "Rice with chicken", "Rice with beef", "Chips", "Chips and chicken", "Chicken (quarter)", "Chicken (half)",
      "Burger", "Chicken burger", "Hot dog", "Samoosa", "Fritters (vitumbuwa)", "Boiled eggs", "Egg sandwich",
      "Tea", "Coffee", "Coca-Cola 300ml", "Fanta 300ml", "Sprite 300ml", "Bottled water 500ml", "Juice", "Maheu",
    ],
  },
];
