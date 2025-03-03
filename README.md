# MHTify

A simple web application that converts .mht files to HTML and PDF while preserving all embedded data, images, links, and other assets.

## Features

- Drag and drop .mht file upload
- Clean, simple interface
- Preservation of all embedded content (images, links, etc.)
- Download functionality for the generated HTML
- Enhanced PDF export with proper formatting and content preservation
- Multi-page PDF support for longer documents
- Fully client-side (runs locally in your browser)
- No data is sent to any server - works completely offline

## Usage

1. Open `index.html` in your web browser
2. Drag and drop an .mht file into the designated area
3. The application will convert the file and display a preview
4. Click the "Download HTML" button to save the HTML and its assets
5. Click the "Download PDF" button to save the content as a PDF file

## Technical Details

MHTify uses pure JavaScript to handle the parsing and conversion of .mht files to HTML and PDF formats. The MIME HTML (.mht) format is essentially a single-file web page archive format that contains the HTML content and all associated resources (like images, CSS, and JavaScript) encoded within a single file using MIME encoding.

### PDF Generation

The PDF generation leverages two powerful libraries:
- **html2canvas**: Captures the rendered HTML content as a canvas
- **jsPDF**: Converts the canvas to a properly formatted PDF document

The PDF conversion process:
1. Renders the HTML content in a hidden container
2. Ensures all resources (images, styles) are properly loaded
3. Uses dynamic width detection to prevent content from being cut off
4. Applies proper centering and margins
5. Handles multi-page documents with intelligent page breaks

## GitHub

This project is available on GitHub at [MHTify](https://github.com/estebanpdl/MHTify).

## License

MIT
