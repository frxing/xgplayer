import SpsParser from './sps';
class Nalunit {
  static getNalunits (buffer) {
    if (buffer.length - buffer.position < 4) {
      return [];
    }

    let buf = buffer.dataview;
    let position = buffer.position;
    if (buf.getInt32(position) === 1 ||
    (buf.getInt16(position) === 0 && buf.getInt8(position + 2) === 1)) {
      return Nalunit.getAnnexbNals(buffer);
    } else {
      return Nalunit.getAvccNals(buffer);
    }
  }

  static getAnnexbNals (buffer) {
    let nals = [];
    let position = Nalunit.getHeaderPositionAnnexB(buffer);
    let start = position.pos;
    let end = start;
    while (start < buffer.length - 4) {
      let header = buffer.buffer.slice(start, start + position.headerLength);
      if (position.pos === buffer.position) {
        buffer.skip(position.headerLength);
      }
      position = Nalunit.getHeaderPositionAnnexB(buffer);
      end = position.pos;
      let body = new Uint8Array(buffer.buffer.slice(start + header.byteLength, end));
      let unit = {header, body};
      Nalunit.analyseNal(unit);
      nals.push(unit);
      buffer.skip(end - buffer.position);
      start = end;
    }
    return nals;
  }

  static getAvccNals (buffer) {
    let nals = [];
    while (buffer.position < buffer.length - 4) {
      let length = buffer.dataview.getInt32();
      if (buffer.length - buffer.position >= length) {
        let header = buffer.buffer.slice(buffer.position, buffer.position + 4);
        buffer.skip(4)
        let body = buffer.buffer.slice(buffer.position, buffer.position + length);
        buffer.skip(length);
        let unit = {header, body};
        Nalunit.analyseNal(unit);
        nals.push(unit);
      } else {
        break;
      }
    }
    return nals;
  }

  static analyseNal (unit) {
    let type = unit.body[0] & 0x1f;
    switch (type) {
      case 1:
        // NDR
        unit.ndr = true;
        break;
      case 5:
        // IDR
        unit.idr = true;
        break;
      case 6:
        // SEI
        break;
      case 7:
        // SPS
        unit.sps = SpsParser.parseSPS(unit.body);
        break;
      case 8:
        // PPS
        unit.pps = true;
        break;
      case 9:
        // AUD
        break;
      default:
        break;
    }
  }

  static getHeaderPositionAnnexB (buffer) {
    // seperate
    let pos = buffer.position;
    let headerLength = 0;
    while (headerLength !== 3 && headerLength !== 4 && pos < buffer.length - 4) {
      if (buffer.dataview.getInt16(pos) === 0) {
        if (buffer.dataview.getInt16(pos + 2) === 1) {
          // 0x000001
          headerLength = 4;
        } else if (buffer.dataview.getInt8(pos + 2) === 1) {
          headerLength = 3;
        } else {
          pos++;
        }
      } else {
        pos++;
      }
    }

    if (pos === buffer.length - 4) {
      if (buffer.dataview.getInt16(pos) === 0) {
        if (buffer.dataview.getInt16(pos + 2) === 1) {
          // 0x000001
          headerLength = 4;
        }
      } else {
        pos++;
        if (buffer.dataview.getInt16(pos) === 0 && buffer.dataview.getInt8(pos) === 1) {
          // 0x0000001
          headerLength = 3;
        } else {
          pos = buffer.length;
        }
      }
    }
    return {pos, headerLength};
  }

  static getAvcc (sps, pps) {
    let ret = new Uint8Array(sps.byteLength + pps.byteLength + 11);
    ret[0] = 0x01;
    ret[1] = sps[1];
    ret[2] = sps[2];
    ret[3] = sps[3];
    ret[4] = 255;
    ret[5] = 225;

    let offset = 6;

    ret.set(new Uint8Array([(sps.byteLength >>> 8) & 0xff, sps.byteLength & 0xff]), offset);
    offset += 2;
    ret.set(sps, offset);
    offset += sps.byteLength;

    ret[offset] = 1;
    offset++;

    ret.set(new Uint8Array([(pps.byteLength >>> 8) & 0xff, pps.byteLength & 0xff]), offset);
    offset += 2;
    ret.set(pps, offset);
    return ret;
  }
}

export default Nalunit;
