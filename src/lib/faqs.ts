import type { FAQItem } from "@/lib/schema";

// MC-046 Stage 1: the days-on-market answer ("an average of 18 days") and the price-appreciation
// claim were derived from sold records (VOW), so they are gone. No homepage surface renders this
// set today (FAQSection has no caller); it is kept clean for when one does.

export const homepageFAQs: FAQItem[] = [
  {
    question: "What is the average home price in Milton Ontario?",
    answer:
      "The average list price for homes in Milton Ontario is approximately $1,125,000 as of 2025, based on live PropTx MLS® active listings. Prices vary by neighbourhood and property type — detached homes average higher while condos and townhouses offer more affordable entry points. Registered users get access to detailed market data, including historical transaction records on street and neighbourhood pages.",
  },
  {
    question: "What are the best neighbourhoods in Milton Ontario?",
    answer:
      "Milton's most popular neighbourhoods include Willmott, Coates, Clarke, Beaty, Dempsey, Hawthorne Village, and Old Milton. Each offers different price ranges, school catchments, and proximity to the Milton GO station. Use the Miltonly neighbourhood comparison tool to compare them side by side.",
  },
  {
    question: "Is Milton Ontario a good place to invest in real estate?",
    answer:
      "Milton is one of Canada's fastest growing cities. Key investment drivers include GO train access to Toronto, top-ranked schools, planned population growth to 228,000, and significant new development. Use Miltonly's free investor report for detailed yield and growth data by neighbourhood.",
  },
  {
    question:
      "What schools are in Milton Ontario and which neighbourhoods are they in?",
    answer:
      "Milton's top schools include Craig Kielburger Secondary (Willmott/Coates area), Bishop Reding Catholic Secondary, Milton District High School (Old Milton), and E.W. Foster Public School. Use Miltonly's school zone search to find homes in specific school catchments.",
  },
  {
    question: "How far is Milton Ontario from Toronto by GO train?",
    answer:
      "Milton GO station connects to Union Station Toronto in approximately 55 minutes by GO train. Many Milton neighbourhoods are within a 5 to 20 minute walk or short drive from the Milton GO station. Miltonly's GO commute filter shows homes by walking distance to the station.",
  },
];
