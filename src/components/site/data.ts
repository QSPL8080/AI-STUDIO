export const heroBadges = [
  "Script Included",
  "5+ AI Video Formats",
  "Up to 60-Second Videos",
  "9:16 Reel Format",
  "48–72 Hour Delivery",
  "1 Revision Included",
];

export const formats = ["AI UGC", "AI Cartoon", "AI Avatar", "Hyper-Realistic", "Digital Twin"];

export const samples = [
  {
    format: "AI UGC",
    industry: "E-Commerce & Fashion",
    description: "Dynamic creator-style AI UGC video with energetic hooks and product showcase.",
    videoUrl: "/videos/UGC Sample.mp4?v=2",
  },
  {
    format: "AI Avatar",
    industry: "Healthcare & Real Estate",
    description:
      "Professional presenter-led explainer reel for clinics, property, and corporate services.",
    videoUrl: "/videos/Avtar Sample.mp4?v=2",
  },
  {
    format: "Hyper-Realistic",
    industry: "Jewellery & Luxury",
    description: "Cinematic product advertisement for a luxury jewellery collection.",
    videoUrl:
      "https://assets.mixkit.co/videos/preview/mixkit-diamond-ring-sparkling-in-the-dark-42866-large.mp4",
  },
  {
    format: "AI Cartoon",
    industry: "Food & Confectionery",
    description:
      "Engaging animated brand storytelling reel with custom characters for Chitale Kesar Modak.",
    videoUrl: "/videos/Cartoon Sample.mp4?v=2",
  },
  {
    format: "Digital Twin",
    industry: "Founder Branding",
    description: "Founder-led update reel created from an approved digital twin.",
    videoUrl:
      "https://assets.mixkit.co/videos/preview/mixkit-man-working-with-futuristic-technology-41485-large.mp4",
  },
];

export const portfolioItems = [
  {
    industry: "3D Character Animation",
    description:
      "Expressive 3D character animation and storytelling reel for creative brands and entertainment.",
    videoUrl: "/videos/Cartoon Portfolio.mp4?v=2",
  },
  {
    industry: "D2C & Consumer Brands",
    description:
      "Authentic creator-led AI UGC product review and demonstration reel designed for high conversions.",
    videoUrl: "/videos/UGC Porfolio.mp4?v=2",
  },
  {
    industry: "Interior Design & Architecture",
    description:
      "High-impact AI avatar presenter reel showcasing 360° growth solutions and premium client acquisition for interior designers.",
    videoUrl: "/videos/Avtar Portfolio.mp4",
  },
  {
    industry: "Jewellery & Luxury",
    description: "Cinematic product advertisement for a luxury jewellery collection.",
    videoUrl:
      "https://assets.mixkit.co/videos/preview/mixkit-diamond-ring-sparkling-in-the-dark-42866-large.mp4",
  },
  {
    industry: "Founder Branding",
    description: "Founder-led update reel created from an approved digital twin.",
    videoUrl:
      "https://assets.mixkit.co/videos/preview/mixkit-man-working-with-futuristic-technology-41485-large.mp4",
  },
  {
    industry: "E-Commerce & Retail",
    description:
      "High-energy commercial advertisement reel showcasing modern product styles and viral hooks.",
    videoUrl: "/videos/UGC Sample.mp4?v=2",
  },
];

export const services = [
  {
    title: "AI UGC Video Production",
    description:
      "Create authentic creator-style videos for your products and services without arranging a traditional influencer shoot.",
    bestFor: "D2C brands, e-commerce, beauty, skincare, food and consumer brands.",
    items: [
      "Product Reviews",
      "Product Demonstrations",
      "Unboxing Videos",
      "Testimonials",
      "Product Recommendations",
      "Problem → Solution Videos",
      "Social Media Advertisements",
    ],
    price: "₹2,499 / Reel",
    cta: "Create AI UGC Video",
  },
  {
    title: "AI Cartoon Animation Services",
    description:
      "Turn your ideas into engaging animated videos using AI-generated characters, scenes and storytelling.",
    bestFor: "Education, coaching, SaaS, children's brands and creative businesses.",
    items: [
      "Explainer Videos",
      "Educational Content",
      "Brand Stories",
      "Animated Reels",
      "Character-Based Videos",
      "Product Explainers",
    ],
    price: "₹2,499 / Reel",
    cta: "Create Cartoon Video",
  },
  {
    title: "AI Avatar Video Production",
    description:
      "Create professional presenter-style videos using realistic AI avatars without requiring a traditional camera shoot.",
    bestFor: "Real Estate, Clinics, Education, Finance, SaaS and professional services.",
    items: [
      "Business Presentations",
      "Educational Videos",
      "Property Videos",
      "Doctor/Clinic Explainers",
      "Service Explainers",
      "Corporate Videos",
      "Social Media Reels",
    ],
    price: "₹3,999 / Reel",
    cta: "Create AI Avatar Video",
  },
  {
    title: "Hyper-Realistic AI Video Production",
    description:
      "Create cinematic AI-generated people, environments, products and scenes for premium visual storytelling.",
    bestFor: "Real Estate, Jewellery, Fashion, Luxury Brands and premium businesses.",
    items: [
      "Product Advertisements",
      "Cinematic Brand Videos",
      "Real Estate Videos",
      "Product Launches",
      "Premium Social Media Content",
      "Advertising Campaigns",
    ],
    price: "₹4,999 / Reel",
    cta: "Create Hyper-Realistic Video",
  },
  {
    title: "AI Digital Twin & Clone Video Services",
    description:
      "Create recurring video content using an appropriately authorized digital twin and AI voice setup.",
    bestFor: "Founders, Doctors, Coaches, Consultants, Educators, Influencers and Personal Brands.",
    items: [
      "Founder Videos",
      "Personal Branding",
      "Educational Reels",
      "Expert Content",
      "Business Updates",
      "Promotional Videos",
      "Social Media Content",
    ],
    price: "₹5,999 / Reel",
    cta: "Create My Digital Twin",
  },
];

export const whyAiVideo = [
  {
    title: "Create More Content",
    description: "Produce more videos for social media, advertising and content marketing.",
  },
  {
    title: "Faster Production",
    description:
      "Create professional video content through streamlined AI-powered production workflows.",
  },
  {
    title: "Reduce Production Complexity",
    description:
      "Reduce dependency on traditional shoots, locations and repeated recording sessions.",
  },
  {
    title: "Consistent Content",
    description: "Maintain consistent messaging, presentation and visual style across your videos.",
  },
  {
    title: "Scalable Video Marketing",
    description:
      "Create one video or multiple videos every month based on your content requirements.",
  },
  {
    title: "Social Media Ready",
    description:
      "Receive videos in vertical 9:16 format suitable for Instagram Reels, Facebook and YouTube Shorts.",
  },
];

export interface PricingItem {
  discounted: string;
  original?: string;
  badge?: string;
}

export interface PricingRow {
  service: string;
  prices: PricingItem[];
}

export const pricingRows: PricingRow[] = [
  {
    service: "AI UGC Video",
    prices: [
      { discounted: "₹2,499" },
      { discounted: "₹10,999", original: "₹12,495", badge: "SAVE 12%" },
      { discounted: "₹20,999", original: "₹24,990", badge: "SAVE 16%" },
      { discounted: "₹30,999", original: "₹37,485", badge: "SAVE 17%" },
    ],
  },
  {
    service: "AI Cartoon Animation",
    prices: [
      { discounted: "₹2,499" },
      { discounted: "₹10,999", original: "₹12,495", badge: "SAVE 12%" },
      { discounted: "₹20,999", original: "₹24,990", badge: "SAVE 16%" },
      { discounted: "₹30,999", original: "₹37,485", badge: "SAVE 17%" },
    ],
  },
  {
    service: "AI Avatar Video",
    prices: [
      { discounted: "₹3,999" },
      { discounted: "₹18,999", original: "₹19,995", badge: "SAVE 5%" },
      { discounted: "₹34,999", original: "₹39,990", badge: "SAVE 12%" },
      { discounted: "₹47,999", original: "₹59,985", badge: "SAVE 20%" },
    ],
  },
  {
    service: "Hyper-Realistic AI Video",
    prices: [
      { discounted: "₹4,999" },
      { discounted: "₹23,999", original: "₹24,995", badge: "SAVE 4%" },
      { discounted: "₹44,999", original: "₹49,990", badge: "SAVE 10%" },
      { discounted: "₹64,999", original: "₹74,985", badge: "SAVE 13%" },
    ],
  },
  {
    service: "AI Digital Twin / Clone",
    prices: [
      { discounted: "₹5,999" },
      { discounted: "₹28,999", original: "₹29,995", badge: "SAVE 3%" },
      { discounted: "₹54,999", original: "₹59,990", badge: "SAVE 8%" },
      { discounted: "₹79,999", original: "₹89,985", badge: "SAVE 11%" },
    ],
  },
];

export const twinFeatures = [
  "Digital Twin Creation & Setup",
  "Face/Avatar Training",
  "Voice Clone Setup",
  "AI Speaking Model Configuration",
  "Lip-Sync Model Setup",
  "Basic Expressions & Gestures",
  "Brand-Ready Avatar Configuration",
  "Initial Testing & Optimization",
  "Setup for Future Digital Twin Videos",
];

export const deliverables = [
  {
    title: "AI UGC Video",
    items: [
      "Up to 60-sec Reel",
      "Script Included",
      "AI Creator/Influencer-Style Video",
      "Product/Service-Focused Script",
      "AI-Generated UGC Creator",
      "Voiceover",
      "Lip-Sync & Expressions",
      "Product/Service Integration",
      "Captions/Subtitles",
      "Background Music",
      "Basic Sound Effects",
      "9:16 Reel Format",
      "1 Revision",
    ],
  },
  {
    title: "AI Cartoon Animation",
    items: [
      "Up to 60-sec Reel",
      "Script Included",
      "Concept & Script Adaptation",
      "AI Cartoon/Animated Characters",
      "Scene-by-Scene Animation",
      "AI Voiceover",
      "Character Expressions & Movements",
      "Backgrounds & Visual Elements",
      "Captions/Subtitles",
      "Background Music & Sound Effects",
      "9:16 Reel Format",
      "1 Revision",
    ],
  },
  {
    title: "AI Avatar Video",
    items: [
      "Up to 60-sec Reel",
      "Script Included",
      "AI Avatar Selection/Creation",
      "Professional Script",
      "AI Voiceover",
      "Natural Lip-Sync",
      "Avatar Expressions & Gestures",
      "Brand/Product Visuals",
      "Captions/Subtitles",
      "Background Music",
      "Basic Motion Graphics",
      "9:16 Reel Format",
      "1 Revision",
    ],
  },
  {
    title: "Hyper-Realistic AI Video",
    items: [
      "Up to 60-sec Reel",
      "Script Included",
      "Hyper-Realistic AI Characters/Scenes",
      "Professional Concept & Script",
      "Cinematic AI Visuals",
      "Realistic Human/Product Movements",
      "AI Voiceover",
      "Lip-Sync Where Applicable",
      "Product/Service Integration",
      "Cinematic Transitions",
      "Sound Design & Background Music",
      "Captions/Subtitles",
      "9:16 Reel Format",
      "1 Revision",
    ],
  },
  {
    title: "AI Digital Twin / Clone",
    items: [
      "Up to 60-sec Reel",
      "Script Included",
      "Digital Twin / Clone-Based Video",
      "Client-Approved Digital Twin",
      "Clone Voiceover",
      "AI Lip-Sync",
      "Facial Expressions & Gestures",
      "Brand/Product Integration",
      "Captions/Subtitles",
      "Background Music",
      "Basic Motion Graphics",
      "9:16 Reel Format",
      "1 Revision",
    ],
  },
];

export const industries = [
  {
    name: "Real Estate",
    description:
      "AI property videos, project explainers, promotional reels and sales-focused content.",
    recommended: "AI Avatar, Hyper-Realistic, Digital Twin",
    image: "/images/1st card.png",
    opacityClass: "opacity-65",
  },
  {
    name: "Clinics & Doctors",
    description:
      "Educational videos, treatment explainers, awareness content and doctor-led communication.",
    recommended: "AI Avatar, Digital Twin, UGC",
    image: "/images/2nd card.png",
  },
  {
    name: "D2C & E-commerce",
    description: "Product demonstrations, reviews, UGC advertisements and product promotions.",
    recommended: "AI UGC, Hyper-Realistic",
    image: "/images/3rd card.png",
  },
  {
    name: "Beauty & Skincare",
    description: "Product recommendations, tutorials, testimonials and creator-style content.",
    recommended: "AI UGC, Hyper-Realistic",
    image: "/images/4th card.png",
  },
  {
    name: "Interior Design",
    description: "Project showcases, design concepts, transformations and premium visual content.",
    recommended: "Hyper-Realistic, AI UGC",
    image: "/images/5th card.png",
  },
  {
    name: "Restaurants & Cafes",
    description: "Food promotions, product videos, animated content and social media reels.",
    recommended: "AI UGC, Cartoon",
    image: "/images/6th card.png",
  },
  {
    name: "Education & Coaching",
    description: "Educational explainers, lessons, promotional videos and presenter content.",
    recommended: "AI Avatar, Cartoon, Digital Twin",
    image: "/images/7th card.png",
  },
  {
    name: "IT & SaaS",
    description:
      "Product explainers, software demonstrations, educational content and promotional videos.",
    recommended: "AI Avatar, Cartoon",
    image: "/images/8th card.png",
  },
  {
    name: "Finance & Insurance",
    description: "Financial explainers, educational content and professional presenter videos.",
    recommended: "AI Avatar, Digital Twin",
    image: "/images/9th card.png",
  },
  {
    name: "Travel & Tourism",
    description: "Destination promotions, travel content, UGC videos and advertising creatives.",
    recommended: "AI UGC, AI Avatar, Hyper-Realistic",
    image: "/images/10th card.png",
  },
  {
    name: "Fitness & Wellness",
    description: "Workout content, wellness education, promotional videos and personal branding.",
    recommended: "AI UGC, Digital Twin",
    image: "/images/11th card.png",
    opacityClass: "opacity-65",
  },
  {
    name: "Jewellery & Luxury",
    description: "Premium product visuals, cinematic advertisements and luxury brand storytelling.",
    recommended: "Hyper-Realistic, AI UGC",
    image: "/images/12th card.png",
  },
];

export const useCases = [
  "Product Advertisements",
  "Product Demonstrations",
  "Product Reviews",
  "Unboxing Videos",
  "AI UGC Advertisements",
  "Customer Testimonials",
  "Real Estate Promotional Videos",
  "Clinic & Doctor Explainers",
  "Educational Videos",
  "Service Explainer Videos",
  "Brand Awareness Reels",
  "Product Launch Videos",
  "Promotional Reels",
  "Founder Videos",
  "Personal Branding Videos",
  "Social Media Advertisements",
  "AI Video Ads",
  "Corporate Communication",
  "Storytelling Videos",
];

export const processSteps = [
  {
    title: "Share Your Requirement",
    description: "Tell us about your business, product/service, audience and video objective.",
  },
  {
    title: "Script & Concept",
    description: "Our team prepares the video script and creative concept.",
  },
  {
    title: "Approve the Script",
    description: "Review and approve the script/concept before production begins.",
  },
  {
    title: "AI Video Production",
    description:
      "We create the AI visuals, voiceover, lip-sync, animation, captions, music and editing.",
  },
  {
    title: "Review & Revision",
    description: "Review the completed video and use the included revision where applicable.",
  },
  {
    title: "Final Delivery",
    description: "After completion of the balance payment, the final video is delivered.",
  },
];

export const whyUs = [
  {
    title: "5+ AI Video Formats",
    description: "From AI UGC and AI avatars to hyper-realistic videos and digital twins.",
  },
  {
    title: "Business-Focused Content",
    description:
      "Scripts and concepts are created around your product, service and target audience.",
  },
  {
    title: "Complete Video Production",
    description: "Script, AI generation, voiceover, lip-sync, captions, music and editing.",
  },
  {
    title: "Fast Turnaround",
    description:
      "Standard delivery within 48–72 working hours after script approval and receipt of required materials.",
  },
  {
    title: "Scalable Packages",
    description: "Choose from single videos or 5, 10 and 15-video packages.",
  },
  {
    title: "Social Media Ready",
    description: "Vertical 9:16 format suitable for modern social media platforms.",
  },
];

export const faqs = [
  {
    question: "What AI video production services does Quickupp AI Studio offer?",
    answer:
      "Quickupp AI Studio offers AI UGC videos, AI cartoon animations, AI avatar videos, hyper-realistic AI videos and AI digital twin or clone videos for businesses.",
  },
  {
    question: "How much does AI video production cost?",
    answer:
      "Our AI video production services start from ₹2,499 per reel. Pricing depends on the selected video format, production requirements and package size.",
  },
  {
    question: "What is included in an AI video?",
    answer:
      "Depending on the selected service, the package can include scripting, AI-generated visuals, voiceover, lip-sync, expressions, captions, music, sound effects, motion graphics and final 9:16 editing.",
  },
  {
    question: "How long does AI video production take?",
    answer:
      "Our standard delivery timeline is 48–72 working hours after script approval and receipt of all required materials.",
  },
  {
    question: "Can you create AI UGC videos for my product?",
    answer:
      "Yes. We create AI UGC videos featuring AI-generated creators for product demonstrations, reviews, recommendations, testimonials and promotional content.",
  },
  {
    question: "Can you create an AI avatar of me?",
    answer:
      "Yes. We can create an appropriately authorized AI avatar or digital twin for clients who want to produce recurring videos using their approved appearance and voice.",
  },
  {
    question: "What is an AI digital twin?",
    answer:
      "An AI digital twin is a reusable digital representation of a person that can be used to create AI-powered videos using an appropriately authorized avatar and voice configuration.",
  },
  {
    question: "Can I use AI videos for Instagram Reels?",
    answer:
      "Yes. Our standard videos are delivered in vertical 9:16 format suitable for Instagram Reels, Facebook and YouTube Shorts.",
  },
  {
    question: "How many revisions are included?",
    answer:
      "One revision is included with the standard package, based on the approved script and concept.",
  },
  {
    question: "Can I order multiple AI videos every month?",
    answer:
      "Yes. We offer 5, 10 and 15-reel packages and can also create customized monthly AI video production plans.",
  },
];

export const nav = [
  { label: "Samples", href: "#samples" },
  { label: "Services", href: "#services" },
  { label: "Pricing", href: "#pricing" },
  { label: "Portfolio", href: "#portfolio" },
  { label: "How It Works", href: "#process" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export const footerTagline = "AI-Powered Videos. Built for Your Business.";
export const footerDescription =
  "Quickupp AI Studio provides professional AI video production services for businesses, brands and creators. Create AI UGC, AI avatar, cartoon, hyper-realistic and digital twin videos for social media, advertising and digital marketing.";
export const footerEmail = "info@quickuppaistudio.com";
export const footerPhone = "+91 9172785916";
export const footerIndiaAddress =
  "Office 411, Suratwala Mark Plazzo, Hinjewadi, Phase 1, Pune, 411057, India";
export const footerIndiaMapUrl = "https://maps.app.goo.gl/geUWrpRet8nY8qbW6";
export const footerUsaAddress = "8 The Green, Suite A, Dover, Delaware - 19901, USA";
export const footerUsaMapUrl = "https://maps.app.goo.gl/2rLqrCN4rco2XpQr5";
export const footerCopyright = `© ${new Date().getFullYear()} Quickupp AI Studio. All rights reserved.`;
