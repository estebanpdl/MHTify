document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const browseButton = document.getElementById('browse-button');
    const previewContainer = document.getElementById('preview-container');
    const previewFilename = document.getElementById('preview-filename');
    const previewFrame = document.getElementById('preview-frame');
    const downloadButton = document.getElementById('download-button');
    const downloadPdfButton = document.getElementById('download-pdf-button');
    const resetButton = document.getElementById('reset-button');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Current file data storage
    let currentFile = null;
    let convertedHTML = null;
    let extractedResources = [];

    // Event Listeners
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    dropArea.addEventListener('drop', handleDrop, false);
    browseButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    downloadButton.addEventListener('click', downloadHTML);
    downloadPdfButton.addEventListener('click', downloadPDF);
    resetButton.addEventListener('click', resetConverter);

    // Helper Functions
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        dropArea.classList.add('highlight');
    }

    function unhighlight() {
        dropArea.classList.remove('highlight');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            handleFiles(files);
        }
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    }

    function handleFiles(files) {
        const file = files[0];
        
        // Check if file is .mht or .mhtml
        if (!file.name.toLowerCase().endsWith('.mht') && !file.name.toLowerCase().endsWith('.mhtml')) {
            alert('Please select a valid .mht or .mhtml file');
            return;
        }

        currentFile = file;
        showLoading();
        
        // Read the file
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const result = await convertMHTToHTML(e.target.result);
                convertedHTML = result.html;
                extractedResources = result.resources;
                
                // Update UI
                previewFilename.textContent = file.name;
                
                // Display preview
                const blob = new Blob([convertedHTML], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                
                // Load the preview in the iframe
                previewFrame.onload = function() {
                    // Attempt to make the iframe content scrollable
                    try {
                        const frameDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
                        
                        // Add CSS to ensure scrolling works within the iframe
                        const style = frameDoc.createElement('style');
                        style.textContent = `
                            html, body {
                                height: 100%;
                                margin: 0;
                                padding: 0;
                                overflow-y: auto !important;
                            }
                        `;
                        frameDoc.head.appendChild(style);
                    } catch(err) {
                        console.error("Could not modify iframe content:", err);
                    }
                };
                
                previewFrame.src = url;
                
                // Show preview container
                hideLoading();
                dropArea.classList.add('hidden');
                previewContainer.classList.remove('hidden');
            } catch (error) {
                hideLoading();
                alert('Error converting file: ' + error.message);
                console.error(error);
            }
        };
        
        reader.readAsText(file);
    }

    async function convertMHTToHTML(mhtContent) {
        // Parse the MIME structure of the MHT file
        const boundaryMatch = mhtContent.match(/boundary="([^"]+)"/i);
        if (!boundaryMatch) {
            throw new Error('Boundary not found in MHT file');
        }
        
        const boundary = boundaryMatch[1];
        const parts = mhtContent.split('--' + boundary);
        
        // Skip the first part (contains MIME headers) and the last part (empty or boundary end)
        const contentParts = parts.slice(1, -1);
        
        let mainHTML = '';
        const resources = [];
        
        // Process each part
        for (const part of contentParts) {
            // Parse headers
            const headerEndIndex = part.indexOf('\r\n\r\n');
            if (headerEndIndex === -1) continue;
            
            const headers = part.substring(0, headerEndIndex);
            const content = part.substring(headerEndIndex + 4); // Skip the double newline
            
            // Parse Content-Type, Content-Location, and Content-Transfer-Encoding
            const contentTypeMatch = headers.match(/Content-Type:\s*([^;\r\n]+)/i);
            const contentLocMatch = headers.match(/Content-Location:\s*([^\r\n]+)/i);
            const contentTransferEncodingMatch = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
            
            if (!contentTypeMatch) continue;
            
            const contentType = contentTypeMatch[1].trim();
            const contentLocation = contentLocMatch ? contentLocMatch[1].trim() : null;
            const contentEncoding = contentTransferEncodingMatch ? contentTransferEncodingMatch[1].trim().toLowerCase() : null;
            
            // Decode content based on encoding
            let decodedContent = content;
            if (contentEncoding === 'base64') {
                try {
                    // Remove line breaks before decoding
                    const base64Content = content.replace(/[\r\n]/g, '');
                    if (contentType.startsWith('text/')) {
                        // For text content, decode to string
                        decodedContent = atob(base64Content);
                    } else {
                        // For binary content (like images), keep the base64 data
                        decodedContent = base64Content;
                    }
                } catch (e) {
                    console.error('Error decoding base64 content:', e);
                    continue;
                }
            } else if (contentEncoding === 'quoted-printable') {
                decodedContent = decodeQuotedPrintable(content);
            }
            
            // If this is the main HTML content
            if (contentType.startsWith('text/html') && !mainHTML) {
                mainHTML = decodedContent;
            } else if (contentLocation) {
                // This is a resource
                resources.push({
                    location: contentLocation,
                    contentType: contentType,
                    content: decodedContent,
                    isBase64: contentEncoding === 'base64' && !contentType.startsWith('text/')
                });
            }
        }
        
        if (!mainHTML) {
            throw new Error('No HTML content found in MHT file');
        }
        
        // Process the HTML to embed resources or update paths
        mainHTML = processHTML(mainHTML, resources);
        
        // Add scrolling CSS to ensure the generated HTML has proper scrolling
        if (!mainHTML.includes('<style id="mht-converter-added-styles">')) {
            const scrollingStyles = `<style id="mht-converter-added-styles">
                html, body {
                    height: 100%;
                    margin: 0;
                    padding: 0;
                    overflow-y: auto !important;
                }
                
                /* Ensure elements don't prevent scrolling */
                body > * {
                    max-width: 100%;
                    overflow-x: auto;
                }
                
                /* Fix for common overflow issues */
                img, table, iframe, video, object {
                    max-width: 100%;
                    height: auto;
                }
            </style>`;
            
            // Add the styles to the head
            if (mainHTML.includes('</head>')) {
                mainHTML = mainHTML.replace('</head>', scrollingStyles + '</head>');
            } else {
                // If no head tag, add it to the beginning of the document
                mainHTML = scrollingStyles + mainHTML;
            }
        }
        
        return {
            html: mainHTML,
            resources: resources
        };
    }

    function processHTML(html, resources) {
        // For each resource, either embed it or update its reference in the HTML
        resources.forEach(resource => {
            const locationParts = resource.location.split('/');
            const filename = locationParts[locationParts.length - 1];
            
            if (resource.contentType.startsWith('image/')) {
                // For images, embed them as data URLs
                const dataURL = resource.isBase64
                    ? `data:${resource.contentType};base64,${resource.content}`
                    : `data:${resource.contentType};base64,${btoa(resource.content)}`;
                
                // Replace all references to this image
                const escapedLocation = escapeRegExp(resource.location);
                const regex = new RegExp(`(src=["'])${escapedLocation}(["'])`, 'gi');
                html = html.replace(regex, `$1${dataURL}$2`);
                
                // Also try with just the filename
                const escapedFilename = escapeRegExp(filename);
                const filenameRegex = new RegExp(`(src=["'])${escapedFilename}(["'])`, 'gi');
                html = html.replace(filenameRegex, `$1${dataURL}$2`);
            } else if (resource.contentType.startsWith('text/css')) {
                // For CSS, embed it in style tags
                const styleTag = `<style data-origin="${resource.location}">${resource.content}</style>`;
                
                // Check if there's a link tag referencing this CSS
                const escapedLocation = escapeRegExp(resource.location);
                const regex = new RegExp(`<link[^>]+href=["']${escapedLocation}["'][^>]*>`, 'gi');
                
                if (regex.test(html)) {
                    html = html.replace(regex, styleTag);
                } else {
                    // If no link tag found, append to head
                    html = html.replace('</head>', `${styleTag}</head>`);
                }
            } else if (resource.contentType.startsWith('text/javascript') || resource.contentType.startsWith('application/javascript')) {
                // For JavaScript, embed it in script tags
                const scriptTag = `<script data-origin="${resource.location}">${resource.content}</script>`;
                
                // Check if there's a script tag referencing this JS
                const escapedLocation = escapeRegExp(resource.location);
                const regex = new RegExp(`<script[^>]+src=["']${escapedLocation}["'][^>]*></script>`, 'gi');
                
                if (regex.test(html)) {
                    html = html.replace(regex, scriptTag);
                } else {
                    // If no script tag found, append to head
                    html = html.replace('</head>', `${scriptTag}</head>`);
                }
            }
            // Other resource types may need special handling
        });
        
        return html;
    }

    function decodeQuotedPrintable(str) {
        // Replace = followed by a newline with nothing
        str = str.replace(/=[\r\n]+/g, '');
        // Replace =XX with the corresponding character
        return decodeURIComponent(escape(
	    str.replace(/=([0-9A-F]{2})/gi, (match, p1) => {
                return String.fromCharCode(parseInt(p1, 16));
        })));
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function downloadHTML() {
        if (!convertedHTML) return;
        
        // Create a blob from the HTML
        const blob = new Blob([convertedHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Create a download link and click it
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFile.name.replace(/\.mht(ml)?$/i, '.html');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up the object URL
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
    
    function downloadPDF() {
        if (!convertedHTML) return;
        
        // Show loading indicator
        showLoading();
        
        try {
            // Create a new hidden div to render the content
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = 0;
            container.style.width = '1200px'; // Increased width to avoid content cutoff
            document.body.appendChild(container);
            
            // Insert the HTML content - add a wrapper to help with centering
            container.innerHTML = `
                <div style="margin: 0 auto; width: 100%; padding: 20px;">
                    ${convertedHTML}
                </div>
            `;
            
            // Add CSS to ensure proper rendering for PDF
            const style = document.createElement('style');
            style.textContent = `
                body {
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                }
                img, table, iframe, video, object {
                    max-width: 100%;
                    height: auto;
                }
                * {
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                /* Additional centering styles */
                body > div {
                    display: block;
                    margin: 0 auto;
                    text-align: left;
                }
                /* Make sure text doesn't get cut off */
                p, div, span, h1, h2, h3, h4, h5, h6 {
                    max-width: 100%;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                }
            `;
            
            // Add the style to the container
            container.appendChild(style);
            
            // Get the filename for the PDF
            const pdfFilename = currentFile.name.replace(/\.mht(ml)?$/i, '.pdf');
            
            // Give the browser some time to render the content
            setTimeout(() => {
                // Find the actual content width to prevent cutoff
                const contentElements = container.querySelectorAll('*');
                let maxWidth = 800; // Default minimum width
                
                contentElements.forEach(el => {
                    if (el.offsetWidth > maxWidth) {
                        maxWidth = el.offsetWidth;
                    }
                });
                
                // Ensure we have adequate width
                container.style.width = (maxWidth + 50) + 'px';
                
                // Render the content to a canvas
                html2canvas(container, {
                    allowTaint: true,
                    useCORS: true,
                    scale: 1.5,
                    logging: false,
                    width: container.offsetWidth,
                    height: container.offsetHeight,
                    x: 0,
                    y: 0,
                    onclone: (clonedDoc) => {
                        // Force all images to load
                        const images = clonedDoc.querySelectorAll('img');
                        images.forEach(img => {
                            if (img.complete) return;
                            img.src = img.src;
                        });
                    }
                }).then(canvas => {
                    try {
                        // Initialize PDF document
                        const pdfWidth = 210; // A4 width in mm
                        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                        
                        // Create PDF - adjust orientation based on content
                        const { jsPDF } = window.jspdf;
                        const pdf = new jsPDF({
                            orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
                            unit: 'mm',
                            format: 'a4'
                        });
                        
                        // Add some margins
                        const margin = 10; // 10mm margin
                        const contentWidth = pdfWidth - (margin * 2);
                        const contentHeight = (contentWidth * canvas.height) / canvas.width;
                        
                        // Convert canvas to image
                        const imgData = canvas.toDataURL('image/jpeg', 0.95);
                        
                        // Add the first page - centered with margins
                        pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight);
                        
                        // Calculate how many pages we need
                        const a4Height = 297 - (margin * 2); // A4 height minus margins
                        if (contentHeight > a4Height) {
                            const totalPages = Math.ceil(contentHeight / a4Height);
                            
                            for (let i = 1; i < totalPages; i++) {
                                pdf.addPage();
                                // Adjust position to show the correct portion of the image on each page
                                pdf.addImage(
                                    imgData, 'JPEG', 
                                    margin, margin - (i * a4Height), // Position to show correct part
                                    contentWidth, contentHeight
                                );
                            }
                        }
                        
                        // Save the PDF
                        pdf.save(pdfFilename);
                    } catch (error) {
                        console.error('Error creating PDF:', error);
                        alert('Error creating PDF: ' + error.message);
                    } finally {
                        // Clean up
                        if (container && container.parentNode) {
                            document.body.removeChild(container);
                        }
                        hideLoading();
                    }
                }).catch(error => {
                    console.error('Error generating canvas:', error);
                    alert('Error generating canvas: ' + error.message);
                    if (container && container.parentNode) {
                        document.body.removeChild(container);
                    }
                    hideLoading();
                });
            }, 1000); // Increased delay to ensure proper rendering
        } catch (error) {
            console.error('Error in PDF generation:', error);
            alert('Error in PDF generation: ' + error.message);
            hideLoading();
        }
    }

    function resetConverter() {
        // Reset state
        currentFile = null;
        convertedHTML = null;
        extractedResources = [];
        
        // Reset UI
        previewFrame.src = 'about:blank';
        fileInput.value = '';
        
        // Show drop area, hide preview
        dropArea.classList.remove('hidden');
        previewContainer.classList.add('hidden');
    }

    function showLoading() {
        loadingIndicator.classList.remove('hidden');
    }

    function hideLoading() {
        loadingIndicator.classList.add('hidden');
    }
});
