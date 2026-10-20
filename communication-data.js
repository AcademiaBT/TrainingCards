export const ACTIVITIES = {
  draw: {
    name: "Desenează după instrucțiuni",
    rounds: [
      { title: "Casa", guide: "O casă cu acoperiș triunghiular, două ferestre, o ușă, un copac în stânga și un soare în dreapta sus.", rule: "Fără întrebări. Ascultă și desenează doar din instrucțiuni." },
      { title: "Peisaj geometric", guide: "Un pătrat mare în centru. În interior: un cerc mic sus-stânga și un triunghi jos-dreapta. O săgeată pornește din pătrat spre o stea aflată în dreapta.", rule: "Poți pune întrebări de clarificare și poți verifica ce ai înțeles." }
    ]
  },
  model: {
    name: "Reconstruiește modelul",
    rounds: [
      { title: "Model 1", rule: "Fără întrebări. Așază piesele numai după descrierea ghidului.", target: [{s:"●",x:2,y:0},{s:"▲",x:1,y:1},{s:"■",x:2,y:1},{s:"▬",x:2,y:2},{s:"➜",x:3,y:2}] },
      { title: "Model 2", rule: "Poți clarifica și reformula înainte să fixezi piesele.", target: [{s:"★",x:0,y:0},{s:"●",x:1,y:1},{s:"■",x:2,y:1},{s:"▲",x:3,y:2},{s:"➜",x:2,y:3}] }
    ]
  },
  client: {
    name: "Ce ai înțeles?",
    rounds: [
      { title:"Plata", message:"Am făcut plata ieri și încă nu apare. Nu înțeleg de ce trebuie să verific eu mereu lucrurile astea.", detail:"Plata apare în contul clientului. Beneficiarul spune că nu a primit banii.", rule:"Răspunde pe baza mesajului inițial, fără informații suplimentare." },
      { title:"Cardul", message:"Mi-ați blocat cardul exact când aveam nevoie de el.", detail:"Cardul este activ. Tranzacția a fost refuzată doar la un comerciant online.", rule:"Înainte de soluție, formulează o întrebare de clarificare și apoi răspunsul tău." }
    ]
  }
};
export const DEBRIEF = [
  "Ce presupuneri ai făcut fără să îți dai seama?",
  "Ce s-a schimbat când ai putut clarifica și verifica înțelegerea?",
  "Ce întrebare ai putea folosi într-o conversație cu un client dificil pentru a preveni escaladarea?"
];
