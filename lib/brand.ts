// People shown in the "Contact us" section of the About page.
// whatsapp: international format, digits only (no + or spaces). Leave a field empty to hide it.
export type Contact = { name: string; role?: string; email?: string; phone?: string; whatsapp?: string };

export const CONTACTS: Contact[] = [
  { name: "Ben Lubona", email: "benlubona735@gmail.com", phone: "0774 832 712", whatsapp: "260774832712" },
  { name: "Joshua Kafupi", email: "bigjosh1747@gmail.com" },
];
