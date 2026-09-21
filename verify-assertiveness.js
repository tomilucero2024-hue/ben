const fs = require('fs');
const O = require('./js/orientador.js');

const data = JSON.parse(fs.readFileSync('data/carreras-perfiles.json', 'utf8'));
global.fetch = async () => ({ ok: true, json: async () => data });

(async () => {
  await O.cargarPerfilesCarreras();
  
  const perfilesTest = {
    'TECH': { analitico: 5, tecnologico: 5, practico: 3, social: 1, creativo: 2, terreno: 0, liderazgo: 1, teorico: 3, matematico: 4, movilidad: 2 },
    'SOCIAL': { analitico: 1, tecnologico: 0, practico: 2, social: 5, creativo: 2, terreno: 1, liderazgo: 3, teorico: 3, matematico: 0, movilidad: 2 },
    'CREATIVO': { analitico: 1, tecnologico: 2, practico: 3, social: 2, creativo: 5, terreno: 0, liderazgo: 1, teorico: 1, matematico: 0, movilidad: 3 },
    'TERRENO': { analitico: 1, tecnologico: 1, practico: 5, social: 1, creativo: 1, terreno: 5, liderazgo: 2, teorico: 0, matematico: 1, movilidad: 4 },
    'MIXTO': { analitico: 3, tecnologico: 3, practico: 3, social: 3, creativo: 3, terreno: 3, liderazgo: 3, teorico: 3, matematico: 3, movilidad: 3 }
  };

  let allPassed = true;

  for (const [nombre, perfil] of Object.entries(perfilesTest)) {
    const ranking = O.generarRanking(perfil, { limite: 200 });
    const count = ranking.total;
    
    console.log(`\n--- Perfil ${nombre} ---`);
    console.log(`Total recomendadas (sobre umbral): ${count}`);
    if (ranking.todas.length > 0) {
       console.log('Top 3:');
       ranking.todas.slice(0, 3).forEach(r => console.log(`  - ${r.compatibilidad}% ${r.nombre} (${r.area})`));
    }
    
    // Asertividad: no debe inundar al usuario
    if (count > 200) {
      console.error(`❌ FALLO: Recomienda demasiadas carreras (${count} > 200)`);
      allPassed = false;
    }
    
    // Mixto no debe ser el 100%
    if (nombre === 'MIXTO' && count >= 580) {
      console.error(`❌ FALLO: MIXTO recomienda TODAS las carreras (${count})`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n✅ Todos los tests de asertividad pasaron.');
  } else {
    console.log('\n❌ Algunos tests fallaron.');
    process.exit(1);
  }
})();
