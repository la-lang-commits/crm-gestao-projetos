import ExcelJS from 'exceljs';
export type ReportSheet = { name: string; headers: string[]; rows: (string | number | null)[][] };
export async function createTicketWorkbook(sheets: ReportSheet[]) {
 const book = new ExcelJS.Workbook();
 book.creator = 'CRM — Gestão de Projetos';
 book.created = new Date();
 for (const data of sheets) {
  const sheet = book.addWorksheet(data.name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(data.headers);
  for (const row of data.rows) sheet.addRow(row.map(value => typeof value === 'string' ? value.slice(0,32767) : value));
  sheet.autoFilter = { from: {row:1,column:1}, to:{row:Math.max(1,sheet.rowCount),column:data.headers.length} };
  sheet.getRow(1).height = 30;
  sheet.getRow(1).eachCell(cell => {cell.font={bold:true,color:{argb:'FFFFFFFF'},size:11};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF205E56'}};});
  sheet.columns.forEach((column,index)=>{column.width=Math.min(55,Math.max(16,data.headers[index].length+3,...data.rows.slice(0,150).map(row=>String(row[index] ?? '').length+2)));});
  sheet.eachRow((row,index)=>{row.alignment={vertical:'top',wrapText:true};if(index>1){row.font={size:11,color:{argb:'FF203E3A'}};if(index%2===0)row.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F5F2'}};});}});
 }
 return book.xlsx.writeBuffer();
}
