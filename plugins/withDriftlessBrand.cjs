const { withDangerousMod } = require('@expo/config-plugins');
const generateBrandIcons = require('../scripts/generate-brand-icons.cjs');

/** Keep native brand resources reproducible when Expo regenerates the ignored android folder. */
module.exports = function withDriftlessBrand(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      await generateBrandIcons();
      return mod;
    },
  ]);
};
