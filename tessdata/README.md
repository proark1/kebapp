# Sprachdaten der Texterkennung

`deu.traineddata` ist das deutsche Modell von Tesseract (tessdata_fast,
Apache-2.0). Es liegt bewusst im Repository statt im Netz: `tesseract.js`
wuerde die Datei sonst beim ersten Belegscan von einem fremden CDN
nachladen. Ein Container ohne ausgehende Verbindung bliebe dabei haengen,
und die Fotos der Lieferantenrechnungen sollen ohnehin keinen
Fremdanbieter beruehren.

Verwendet von `src/server/accounting/receipt-ocr.ts` ueber die Option
`cachePath`. Der Dateiname muss `deu.traineddata` bleiben - danach sucht
tesseract.js.
