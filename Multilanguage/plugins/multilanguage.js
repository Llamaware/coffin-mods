const MAX_LENGTH_TL = 50;
const MAX_LENGTH_EN = 100;

Lang.loadCSV = function (filePath) {
  let csvData = this.newData(),
    fileContent = "";
  try {
    fileContent = Utils.readFile(filePath, "utf8");
  } catch (error) {
    App.fail("Error reading file: " + filePath, error);
    return {};
  }
  let currentBlockType = "",
    prevSection = "",
    currentLines = [],
    newBlockFlag = false;
  for (let line of fileContent.split("\n")) {
    line = line.trim();
    if (!line) {
      continue;
    }
    let parsedColumns = [],
      currentValue = "",
      charIndex = 0,
      inQuotes = false,
      lineLength = line.length;
    while (charIndex < lineLength) {
      let char = line[charIndex];
      if (!inQuotes && char === "\"") {
        inQuotes = true;
      } else {
        if (char === "“" || char === "”") {
          currentValue += "\"";
        } else {
          if (line.substr(charIndex, 2) == "\"\"") {
            currentValue += "\"";
            charIndex += 1;
          } else {
            if (inQuotes && char == "\"") {
              inQuotes = false;
            } else {
              !inQuotes && char == "," ? (parsedColumns.push(currentValue), currentValue = "") : currentValue += char;
            }
          }
        }
      }
      charIndex += 1;
      charIndex >= lineLength && parsedColumns.push(currentValue);
    }
    let columnCount = parsedColumns.length;
    if (columnCount < 1 || parsedColumns[0].trim() === "") {
      continue;
    }
    if (columnCount < 2) {
      App.fail("CSV line missing columns.\nLine: " + line + "\nFile: " + filePath);
      return {};
    }
    let firstColumnValue = parsedColumns[0].toUpperCase();
    if (!firstColumnValue.trim()) {
      App.fail("CSV first column missing.\nLine: " + line + "\nFile: " + filePath);
      return {};
    }
    if (this.new_block(firstColumnValue, currentBlockType, parsedColumns)) {
      currentBlockType = firstColumnValue;
      newBlockFlag = true;
      continue;
    }
    if (newBlockFlag && currentBlockType === "SECTION") {
      this.is_header(parsedColumns) && (newBlockFlag = false);
      continue;
    }
    if (columnCount < CSV_BLOCKS[currentBlockType]) {
      App.fail("CSV missing columns. Total: " + CSV_BLOCKS[currentBlockType] + " Found: " + columnCount + "\nLine: " + line + "\nFile: " + filePath);
      return {};
    }
    if (currentBlockType === "LANGUAGE") {
      csvData.langName = parsedColumns[0];
      csvData.fontFace = parsedColumns[1];
      csvData.fontSize = parseInt(parsedColumns[2]);
      currentBlockType = "";
    } else {
      if (currentBlockType === "CREDIT 1") {
        csvData.langInfo = parsedColumns.slice(0, Math.min(3, columnCount));
        currentBlockType = "";
      } else {
        if (currentBlockType === "LABELS") {
          csvData.sysLabel[parsedColumns[0]] = parsedColumns[2].trim() ? parsedColumns[2] : parsedColumns[1];
        } else {
          if (currentBlockType === "MENUS") {
            csvData.sysMenus[parsedColumns[0]] = parsedColumns[1].trim() ? parsedColumns[1] : parsedColumns[0];
          } else {
            if (currentBlockType === "ITEMS" || currentBlockType === "SPEAKERS") {
              let key = parsedColumns[0],
                primaryValue = parsedColumns[1],
                secondaryValue = parsedColumns[2];
              if (!key.trim() || !primaryValue.trim()) {
                App.fail("Missing column data for Item.\nLine: " + line + "\nFile: " + filePath);
                return {};
              }
              secondaryValue = secondaryValue.trim() ? secondaryValue : primaryValue;
              csvData.labelLUT[key] = secondaryValue;
            } else {
              if (currentBlockType === "SECTION" || currentBlockType === "DESCRIPTIONS") {
                let sectionKey = parsedColumns[0],
                  descriptionType = parsedColumns[1],
                  descriptionValue = parsedColumns[2],
                  displayValue = parsedColumns[3];
                if (!sectionKey.trim() || !descriptionType.trim()) {
                  App.fail("Missing column data for Section.\nLine: " + line + "\nFile: " + filePath);
                  return {};
                }
                displayValue = displayValue.trim() ? displayValue : descriptionValue;
                if (descriptionType.toUpperCase().includes("CHOICE")) {
                  csvData.labelLUT[sectionKey] = displayValue;
                } else {
                  if (prevSection != sectionKey) {
                    currentLines = [];
                    csvData.linesLUT[sectionKey] = currentLines;
                    prevSection = sectionKey;
                  }
                  currentLines.push(displayValue);
				  currentLines.push(descriptionValue);
                }
              } else {
                App.fail("Invalid CSV parsing state.");
                return {};
              }
            }
          }
        }
      }
    }
  }
  return csvData;
};

Game_Interpreter.prototype.command101 = function () {
  if (!$gameMessage.isBusy()) {
    if (this.extraLines.length > 0) {
      $gameMessage.add(this.prevHeader);
      var lineLimit = Math.min(this.extraLines.length, MAX_LINES);
      for (var lineIndex = 0; lineIndex < lineLimit; lineIndex++) {
        $gameMessage.add(this.extraLines.shift());
      }
      this.extraLines.length < 1 && this._index++;
      this.setWaitMode("message");
      return false;
    }
    $gameMessage.setFaceImage(this._params[0], this._params[1]);
    $gameMessage.setBackground(this._params[2]);
    $gameMessage.setPositionType(this._params[3]);
    while (this.nextEventCode() === 401) {
      this._index++;
      var labelKey = this.currentCommand().parameters[0],
        labelData = Lang.lines(Lang.label(labelKey, true));
      $gameMessage.add(labelData.text);
      this.prevHeader = labelData.text;
      if (labelData.lines.length) {
        let oddLines = [];
        let evenLines = [];
        for (var i = 0; i < labelData.lines.length; i++) {
          if (i % 2 === 0) {
            oddLines.push(labelData.lines[i]);
          } else {
            if (evenLines.length === 0) {
              evenLines.push('\\>' + labelData.lines[i]);
            } else {
              evenLines.push(labelData.lines[i]);
            }
          }
        }
        let concatenatedLines = [];
        let oddConcatenated = oddLines.join(" ").replace(/\s+/g, " ");
        let evenConcatenated = evenLines.join(" ").replace(/\s+/g, " ");
        
        if (oddConcatenated.length > MAX_LENGTH_TL) {
          oddConcatenated = '\\}' + oddConcatenated + '\\{';
        }
        if (evenConcatenated.length > MAX_LENGTH_EN) {
          evenConcatenated = '\\}' + evenConcatenated + '\\{';
        }
        
        concatenatedLines.push(oddConcatenated);
        concatenatedLines.push(evenConcatenated);
        for (var k = 0; k < concatenatedLines.length; k++) {
          if (k < MAX_LINES) {
            $gameMessage.add(concatenatedLines[k]);
          } else {
            this.extraLines.push(concatenatedLines[k]);
          }
        }
      }
      if (this.extraLines.length > 0) {
        while (this._index >= 0 && this.currentCommand().code !== 101) {
          this._index--;
        }
        this.setWaitMode("message");
        return;
      }
    }
    switch (this.nextEventCode()) {
      case 102:
        this._index++;
        this.setupChoices(this.currentCommand().parameters);
        break;
      case 103:
        this._index++;
        this.setupNumInput(this.currentCommand().parameters);
        break;
      case 104:
        this._index++;
        this.setupItemChoice(this.currentCommand().parameters);
        break;
    }
    this._index++;
    this.setWaitMode("message");
  }
  return false;
};

Yanfly.Param.MSGDefaultWidth = "1280";
Yanfly.Param.MSGFontSizeChange = "4";