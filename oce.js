const { Cvocr } = require('captcha-cv-ocr');

async function runOcr(imagePath) {
  const cvocr = new Cvocr('simplest');
  await cvocr.init([{ num: 1 }]);
  const result = await cvocr.recognize(imagePath);
  return result;
}

module.exports = { runOcr };
