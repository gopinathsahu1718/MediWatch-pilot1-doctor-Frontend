export type RiskLevel = "Low" | "Medium" | "High";

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  contact: string;
  relativeContact: string;
  state: string;
  district: string;
  diagnosis: string;
  conditionType: string;
  risk: RiskLevel;
  monitoringDays: number;
  registeredOn: string;
  status: "Active" | "Inactive" | "Completed";
  medicines: Medicine[];
  submissions: DaySubmission[];
}

export interface Medicine {
  name: string;
  duration: number;
  frequency: string;
  instruction: string;
}

export interface DaySubmission {
  day: number;
  date: string;
  painScore: number;
  swelling: string;
  mobility: string;
  notes: string;
  images: string[];
}

export const DUMMY_PATIENTS: Patient[] = [
  {
    id: "MW-100234",
    name: "Priya Sharma",
    age: 42,
    gender: "Female",
    contact: "+91 98765 43210",
    relativeContact: "+91 87654 32109",
    state: "Andhra Pradesh",
    district: "Guntur",
    diagnosis: "Inflammatory Arthritis",
    conditionType: "Follow-up",
    risk: "High",
    monitoringDays: 14,
    registeredOn: "2025-05-01",
    status: "Active",
    medicines: [
      { name: "Tab. Methotrexate", duration: 14, frequency: "Once daily", instruction: "After Food" },
      { name: "Tab. Folic Acid", duration: 14, frequency: "Once daily", instruction: "After Food" },
    ],
    submissions: [
      { day: 1, date: "2025-05-01", painScore: 8, swelling: "Severe", mobility: "Limited", notes: "Significant pain in knee joints", images: [] },
      { day: 2, date: "2025-05-02", painScore: 7, swelling: "Moderate", mobility: "Limited", notes: "Slight improvement", images: [] },
      { day: 3, date: "2025-05-03", painScore: 6, swelling: "Moderate", mobility: "Moderate", notes: "Pain reducing", images: [] },
    ],
  },
  {
    id: "MW-100235",
    name: "Rajesh Kumar",
    age: 58,
    gender: "Male",
    contact: "+91 91234 56789",
    relativeContact: "+91 80123 45678",
    state: "Tamil Nadu",
    district: "Chennai",
    diagnosis: "Chronic Pain",
    conditionType: "New Patient",
    risk: "Medium",
    monitoringDays: 10,
    registeredOn: "2025-05-03",
    status: "Active",
    medicines: [
      { name: "Tab. Pregabalin", duration: 10, frequency: "Twice daily", instruction: "After Food" },
      { name: "Tab. Amitriptyline", duration: 10, frequency: "Once daily", instruction: "Before Food" },
    ],
    submissions: [
      { day: 1, date: "2025-05-03", painScore: 5, swelling: "Mild", mobility: "Good", notes: "Manageable pain", images: [] },
    ],
  },
  {
    id: "MW-100236",
    name: "Anitha Reddy",
    age: 35,
    gender: "Female",
    contact: "+91 99887 76655",
    relativeContact: "",
    state: "Andhra Pradesh",
    district: "Vijayawada",
    diagnosis: "Auto Immune Connective Tissue Disorder",
    conditionType: "New Patient",
    risk: "High",
    monitoringDays: 14,
    registeredOn: "2025-05-04",
    status: "Active",
    medicines: [
      { name: "Tab. Hydroxychloroquine", duration: 14, frequency: "Once daily", instruction: "After Food" },
    ],
    submissions: [],
  },
  {
    id: "MW-100237",
    name: "Suresh Babu",
    age: 65,
    gender: "Male",
    contact: "+91 95432 10987",
    relativeContact: "+91 84321 09876",
    state: "Karnataka",
    district: "Bangalore",
    diagnosis: "Soft Tissue Disorder",
    conditionType: "Follow-up",
    risk: "Low",
    monitoringDays: 7,
    registeredOn: "2025-04-20",
    status: "Completed",
    medicines: [
      { name: "Tab. Ibuprofen", duration: 7, frequency: "Thrice daily", instruction: "After Food" },
    ],
    submissions: [
      { day: 1, date: "2025-04-20", painScore: 4, swelling: "Mild", mobility: "Good", notes: "Mild discomfort", images: [] },
      { day: 7, date: "2025-04-26", painScore: 1, swelling: "None", mobility: "Full", notes: "Fully recovered", images: [] },
    ],
  },
  {
    id: "MW-100238",
    name: "Meena Devi",
    age: 48,
    gender: "Female",
    contact: "+91 97654 32198",
    relativeContact: "+91 86543 21987",
    state: "Kerala",
    district: "Kochi",
    diagnosis: "Inflammatory Arthritis",
    conditionType: "Follow-up",
    risk: "Medium",
    monitoringDays: 10,
    registeredOn: "2025-04-28",
    status: "Inactive",
    medicines: [
      { name: "Tab. Sulfasalazine", duration: 10, frequency: "Twice daily", instruction: "After Food" },
    ],
    submissions: [
      { day: 1, date: "2025-04-28", painScore: 6, swelling: "Moderate", mobility: "Limited", notes: "Morning stiffness", images: [] },
    ],
  },
];

export const DOCTOR = {
  name: "Dr. Arjun Mehta",
  specialization: "Rheumatology",
  phone: "+91 98001 23456",
  email: "dr.arjun@mediwatch.in",
  hospital: "Apollo Hospitals, Hyderabad",
  experience: "14 years",
  license: "MCI-AP-2010-4821",
};
