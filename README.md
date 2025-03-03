# MHT to HTML Converter

A simple web application that converts .mht files to HTML while preserving all embedded data, images, links, and other assets.

## Features

- Drag and drop .mht file upload
- Clean, simple interface
- Preservation of all embedded content (images, links, etc.)
- Download functionality for the generated HTML
- Export to PDF with proper formatting
- Fully client-side (runs locally in your browser)

## Usage

1. Open `index.html` in your web browser
2. Drag and drop an .mht file into the designated area
3. The application will convert the file and display a preview
4. Click the "Download HTML" button to save the HTML and its assets
5. Click the "Download PDF" button to save the content as a PDF file

## Technical Details

This application uses pure JavaScript to handle the parsing and conversion of .mht files to HTML. The MIME HTML (.mht) format is essentially a single-file web page archive format that contains the HTML content and all associated resources (like images, CSS, and JavaScript) encoded within a single file using MIME encoding.

## License

MIT
