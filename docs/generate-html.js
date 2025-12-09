/**
 * Generate HTML from Markdown documentation files
 * BookMyEnv v4.2.0
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// HTML template with CSS styling matching existing docs
const htmlTemplate = (title, content) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BookMyEnv - ${title}</title>
    <style>
        :root {
            --primary: #1976d2;
            --success: #4caf50;
            --warning: #ff9800;
            --error: #f44336;
            --gray-50: #fafafa;
            --gray-100: #f5f5f5;
            --gray-200: #eeeeee;
            --gray-800: #424242;
            --gray-900: #212121;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: white;
            color: var(--gray-900);
            line-height: 1.7;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        h1 { 
            color: var(--primary); 
            border-bottom: 3px solid var(--primary); 
            padding-bottom: 10px; 
            margin-bottom: 30px; 
        }
        h2 { 
            color: var(--gray-800); 
            margin: 30px 0 15px; 
            padding-bottom: 8px; 
            border-bottom: 1px solid var(--gray-200); 
        }
        h3 { color: var(--gray-800); margin: 20px 0 10px; }
        h4 { color: var(--gray-800); margin: 15px 0 8px; }
        
        p { margin: 10px 0; }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 14px;
        }
        
        th, td {
            border: 1px solid var(--gray-200);
            padding: 10px 12px;
            text-align: left;
        }
        
        th { background: var(--gray-100); font-weight: 600; }
        tr:nth-child(even) { background: var(--gray-50); }
        
        code {
            background: var(--gray-100);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 13px;
        }
        
        pre {
            background: var(--gray-900);
            color: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 15px 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        pre code { background: none; padding: 0; color: inherit; }
        
        .alert {
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
        }
        
        .alert-warning {
            background: #fff3e0;
            border-left: 4px solid var(--warning);
        }
        
        .alert-danger {
            background: #ffebee;
            border-left: 4px solid var(--error);
        }
        
        .alert-success {
            background: #e8f5e9;
            border-left: 4px solid var(--success);
        }
        
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .badge-new {
            background: var(--success);
            color: white;
        }
        
        ul, ol { margin: 10px 0 10px 25px; }
        li { margin: 5px 0; }
        
        a { color: var(--primary); text-decoration: none; }
        a:hover { text-decoration: underline; }
        
        blockquote {
            border-left: 4px solid var(--primary);
            padding: 10px 20px;
            margin: 15px 0;
            background: var(--gray-50);
        }
        
        hr {
            border: none;
            border-top: 1px solid var(--gray-200);
            margin: 30px 0;
        }
        
        .new-badge::after {
            content: "NEW";
            background: var(--success);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            margin-left: 8px;
            vertical-align: middle;
        }
        
        .version-badge {
            background: var(--primary);
            color: white;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            margin-left: 10px;
        }
        
        /* Syntax highlighting classes */
        .hljs-keyword { color: #c792ea; }
        .hljs-string { color: #c3e88d; }
        .hljs-comment { color: #546e7a; }
        .hljs-number { color: #f78c6c; }
        
        /* Footer */
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid var(--gray-200);
            text-align: center;
            color: var(--gray-800);
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
        <div class="footer">
            <p>BookMyEnv v4.2.0 | January 2025</p>
            <p>Documentation generated automatically</p>
        </div>
    </div>
</body>
</html>`;

// Configure marked options
marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: true,
});

// Files to convert
const files = [
    { md: 'CHANGELOG.md', html: 'CHANGELOG.html', title: 'Changelog' },
    { md: 'USER_GUIDE.md', html: 'USER_GUIDE.html', title: 'User Guide' },
    { md: 'SECURITY.md', html: 'SECURITY.html', title: 'Security Guide' },
    { md: 'QUICK_REFERENCE.md', html: 'QUICK_REFERENCE.html', title: 'Quick Reference' },
    { md: 'ARCHITECTURE.md', html: 'ARCHITECTURE.html', title: 'Architecture' },
    { md: 'DATA_SETUP_GUIDE.md', html: 'DATA_SETUP_GUIDE.html', title: 'Data Setup Guide' },
    { md: 'DEMO_GUIDE.md', html: 'DEMO_GUIDE.html', title: 'Demo Guide' },
];

// Convert each file
files.forEach(({ md, html, title }) => {
    const mdPath = path.join(__dirname, md);
    const htmlPath = path.join(__dirname, html);
    
    try {
        if (fs.existsSync(mdPath)) {
            const markdown = fs.readFileSync(mdPath, 'utf8');
            
            // Process markdown: Replace ⭐ NEW markers with styled badges
            let processedMd = markdown
                .replace(/⭐ NEW/g, '<span class="badge badge-new">⭐ NEW</span>');
            
            const htmlContent = marked.parse(processedMd);
            const fullHtml = htmlTemplate(title, htmlContent);
            
            fs.writeFileSync(htmlPath, fullHtml, 'utf8');
            console.log(`✅ Generated: ${html}`);
        } else {
            console.log(`⚠️ Skipped (not found): ${md}`);
        }
    } catch (error) {
        console.error(`❌ Error processing ${md}:`, error.message);
    }
});

console.log('\n📄 HTML documentation generation complete!');
