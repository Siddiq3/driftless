#!/usr/bin/env python3
"""Inspect an AAB without signing it. ELF alignment is necessary, not device QA."""
import argparse
import json
import struct
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('bundle', type=Path)
args = parser.parse_args()
with zipfile.ZipFile(args.bundle) as archive:
    names = archive.namelist()
    libraries = []
    for name in names:
        if not name.endswith('.so') or not any('/' + abi + '/' in name for abi in ('arm64-v8a', 'x86_64')):
            continue
        data = archive.read(name)
        if data[:4] != b'\x7fELF' or data[4] != 2:
            raise SystemExit('Expected a 64-bit ELF: ' + name)
        endian = '<' if data[5] == 1 else '>'
        offset = struct.unpack_from(endian + 'Q', data, 32)[0]
        size, count = struct.unpack_from(endian + 'HH', data, 54)
        loads = []
        for index in range(count):
            header = offset + index * size
            if struct.unpack_from(endian + 'I', data, header)[0] == 1:
                file_offset, address = struct.unpack_from(endian + 'QQ', data, header + 8)
                alignment = struct.unpack_from(endian + 'Q', data, header + 48)[0]
                loads.append(alignment >= 16384 and (address - file_offset) % 16384 == 0)
        libraries.append({'name': name, 'elf16KAligned': bool(loads) and all(loads)})
    signatures = [name for name in names if name.upper().startswith('META-INF/') and name.upper().endswith(('.RSA', '.DSA', '.EC'))]
    result = {
        'bundle': str(args.bundle),
        'baseManifestPresent': 'base/manifest/AndroidManifest.xml' in names,
        'hasSignatureBlock': bool(signatures),
        'checked64BitLibraries': len(libraries),
        'elf16KFailures': [row['name'] for row in libraries if not row['elf16KAligned']],
        'limits': 'Signature blocks are not certificate verification. ELF checks do not prove APK ZIP alignment or runtime compatibility. Verify the final signed EAS artifact and test a 16 KB device.',
    }
    print(json.dumps(result, indent=2))
    if not result['baseManifestPresent'] or not libraries or result['elf16KFailures']:
        raise SystemExit(1)
