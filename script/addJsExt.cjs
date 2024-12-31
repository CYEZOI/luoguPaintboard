const fs = require('fs');
const path = require('path');
const glob = require('glob');

const distDir = path.resolve(__dirname, '../dist');
const files = glob.sync(`${distDir}/**/*.js`);

files.forEach(file => {
    const contents = fs.readFileSync(file, 'utf8');
    const newContents = contents.replace(/import (.+) from '\.\/(.+)';/g, (match, p1, p2) => {
        if (p2.endsWith('.js')) {
            return match;
        }
        return `import ${p1} from './${p2}.js';`;
    });
    fs.writeFileSync(file, newContents, 'utf8');
});
