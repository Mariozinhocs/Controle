<?php
header('Content-Type: application/json');

$filename = isset($_GET['file']) ? basename($_GET['file']) : 'backup_controle_Frota_Principal_09-09-2026_140513.xlsx';
$filePath = __DIR__ . '/backups/' . $filename;

if (!file_exists($filePath)) {
    echo json_encode(['success' => false, 'message' => 'File not found']);
    exit;
}

$zip = new ZipArchive();
if ($zip->open($filePath) !== TRUE) {
    echo json_encode(['success' => false, 'message' => 'Cannot open zip']);
    exit;
}

$entries = [];
for ($i = 0; $i < $zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    $entries[] = [
        'name' => $stat['name'],
        'size' => $stat['size']
    ];
}

$zip->close();

echo json_encode(['success' => true, 'file' => $filename, 'entries' => $entries]);
