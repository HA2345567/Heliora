const crypto = require('crypto');
const fs = require('fs');

function getDiscriminator(name) {
  const hash = crypto.createHash('sha256').update(`account:${name}`).digest();
  return Array.from(hash.slice(0, 8));
}

const idlPath = 'programs/heliora_market_factory/target/idl/heliora_market_factory.json';
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

idl.accounts = idl.accounts.map(acc => ({
  ...acc,
  discriminator: getDiscriminator(acc.name)
}));

fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
console.log('✅ Updated IDL with discriminators');
console.log('Market:', getDiscriminator('Market'));
console.log('Position:', getDiscriminator('Position'));
console.log('OracleVote:', getDiscriminator('OracleVote'));
