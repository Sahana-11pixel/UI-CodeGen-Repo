const files = [
    {
        "filename": "App.vue",
        "content": "<template>\n  <Header />\n</template>\n<script>\nimport Header from './Header.vue';\nexport default {\n  name: 'App',\n  components: {\n    Header\n  }\n};\n</script>\n<style></style>"
    }
];

const mainFile = files.find(f => f.filename.endsWith('.vue')) || files[0];
const code = mainFile ? mainFile.content : '';

const templateMatch = code.match(/<template>([\s\S]*?)<\/template>/);
const scriptMatch = code.match(/<script.*?>([\s\S]*?)<\/script>/);

const template = templateMatch ? templateMatch[1] : '';
const script = scriptMatch ? scriptMatch[1].replace('export default', 'const App =') : 'const App = {}';

console.log("=== VUE SCRIPT ===");
console.log(script);
