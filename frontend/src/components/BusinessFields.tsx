import { Collapse, Descriptions, Divider, Form, Input, InputNumber, Select } from 'antd'
import type { OrderItem, ProductFields } from '../types'

type Prefix = Array<string | number>
type Section = 'basic' | 'spec' | 'price'
const field = (prefix: Prefix | undefined, key: string) => prefix ? [...prefix, key] : key

export function ProductFieldsForm({ prefix, sections = ['basic', 'spec', 'price'] }: { prefix?: Prefix; sections?: Section[] }) {
  return <>
    {sections.includes('basic') && <div className="field-section"><Divider orientation="left">产品基础信息</Divider><div className="field-grid">
      <Form.Item label="产品名" name={field(prefix, 'product_name')}><Input /></Form.Item><Form.Item label="原料部位" name={field(prefix, 'raw_material_part')}><Input /></Form.Item>
      <Form.Item label="产品品类" name={field(prefix, 'product_category')}><Input /></Form.Item><Form.Item label="肉类等级" name={field(prefix, 'meat_grade')}><Input /></Form.Item>
      <Form.Item label="品种" name={field(prefix, 'variety')}><Input /></Form.Item><Form.Item label="货品状态" name={field(prefix, 'goods_status')}><Input /></Form.Item>
      <Form.Item label="厂商/厂号" name={field(prefix, 'manufacturer')}><Input /></Form.Item><Form.Item label="进口/国产" name={field(prefix, 'import_domestic')}><Input /></Form.Item>
      <Form.Item label="产地来源" name={field(prefix, 'origin')}><Input /></Form.Item><Form.Item label="产品执行标准" name={field(prefix, 'execution_standard')}><Input /></Form.Item>
    </div></div>}
    {sections.includes('spec') && <div className="field-section"><Divider orientation="left">产品规格</Divider><div className="field-grid">
      <Form.Item label="加工方式" name={field(prefix, 'processing_method')}><Input /></Form.Item><Form.Item label="产品形态" name={field(prefix, 'product_form')}><Input /></Form.Item>
      <Form.Item label="肥瘦比例" name={field(prefix, 'fat_lean_ratio')}><Input /></Form.Item><Form.Item label="精修等级" name={field(prefix, 'trimming_grade')}><Input /></Form.Item>
      <Form.Item label="切割长度" name={field(prefix, 'cut_length')}><InputNumber min={0} className="full-width" /></Form.Item><Form.Item label="长度单位" name={field(prefix, 'length_unit')}><Input placeholder="cm" /></Form.Item>
      <Form.Item label="切割宽度" name={field(prefix, 'cut_width')}><InputNumber min={0} className="full-width" /></Form.Item><Form.Item label="宽度单位" name={field(prefix, 'width_unit')}><Input placeholder="cm" /></Form.Item>
      <Form.Item label="切割厚度" name={field(prefix, 'cut_thickness')}><InputNumber min={0} className="full-width" /></Form.Item><Form.Item label="厚度单位" name={field(prefix, 'thickness_unit')}><Input placeholder="mm" /></Form.Item>
    </div><Form.Item label="加工规格详细" name={field(prefix, 'processing_details')}><Input.TextArea rows={3} /></Form.Item><Form.Item label="包装方案" name={field(prefix, 'packaging_plan')}><Input.TextArea rows={3} /></Form.Item></div>}
    {sections.includes('price') && <div className="field-section"><Divider orientation="left">单份供价</Divider><div className="field-grid">
      <Form.Item label="单位价格" name={field(prefix, 'unit_price')}><InputNumber min={0} precision={2} className="full-width" /></Form.Item><Form.Item label="价格单位" name={field(prefix, 'price_currency')}><Input placeholder="元" /></Form.Item>
      <Form.Item label="计价单位" name={field(prefix, 'pricing_unit')}><Input placeholder="份、kg、箱、件" /></Form.Item><Form.Item label="是否含税" name={field(prefix, 'tax_included')}><Select allowClear options={[{ value: true, label: '是' }, { value: false, label: '否' }]} /></Form.Item>
      <Form.Item label="税率" name={field(prefix, 'tax_rate')}><InputNumber min={0} precision={2} addonAfter="%" className="full-width" /></Form.Item><Form.Item label="配送费" name={field(prefix, 'delivery_fee')}><InputNumber min={0} precision={2} className="full-width" /></Form.Item>
    </div></div>}
  </>
}

const basicLabels: Array<[keyof ProductFields, string]> = [['product_name','产品名'],['raw_material_part','原料部位'],['product_category','产品品类'],['meat_grade','肉类等级'],['variety','品种'],['goods_status','货品状态'],['manufacturer','厂商/厂号'],['import_domestic','进口/国产'],['origin','产地来源'],['execution_standard','产品执行标准']]
const specLabels: Array<[keyof ProductFields, string]> = [['processing_method','加工方式'],['product_form','产品形态'],['fat_lean_ratio','肥瘦比例'],['cut_length','切割长度'],['length_unit','长度单位'],['cut_width','切割宽度'],['width_unit','宽度单位'],['cut_thickness','切割厚度'],['thickness_unit','厚度单位'],['trimming_grade','精修等级'],['processing_details','加工规格详细'],['packaging_plan','包装方案']]
const priceLabels: Array<[keyof ProductFields, string]> = [['unit_price','单位价格'],['price_currency','价格单位'],['pricing_unit','计价单位'],['tax_included','是否含税'],['tax_rate','税率'],['delivery_fee','配送费']]
const display = (value: unknown) => value === null || value === undefined || value === '' ? '无' : typeof value === 'boolean' ? (value ? '是' : '否') : String(value)
const DetailGroup = ({ title, labels, value }: { title: string; labels: Array<[keyof ProductFields, string]>; value: ProductFields }) => <div className="detail-field-group"><Divider orientation="left">{title}</Divider><Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }} items={labels.map(([key,label]) => ({ key, label, children: display(value[key]) }))} /></div>
export function ProductDetails({ value, sections = ['basic','spec','price'] }: { value: ProductFields; sections?: Section[] }) { return <>{sections.includes('basic')&&<DetailGroup title="产品基础信息" labels={basicLabels} value={value}/>} {sections.includes('spec')&&<DetailGroup title="产品规格" labels={specLabels} value={value}/>} {sections.includes('price')&&<DetailGroup title="单份供价" labels={priceLabels} value={value}/>}</> }

export function OrderProductDetails({ items }: { items: OrderItem[] }) {
  if (!items.length) return <div className="empty-product-details">暂无产品明细</div>
  return <section className="order-product-section">
    <Divider orientation="left">产品明细</Divider>
    <Collapse
      className="order-product-collapse"
      items={items.map((item, index) => ({
        key: item.id || String(index),
        label: <div className="order-product-label">
          <strong>{item.product_name || '未命名产品'}</strong>
          <span>{[item.supplier_name || '本公司供应', item.total_quantity ? `总量 ${item.total_quantity}${item.quantity_unit || ''}` : undefined].filter(Boolean).join(' · ')}</span>
        </div>,
        children: <>
          <Descriptions size="small" column={{ xs: 1, sm: 3 }} items={[
            { key: 'supplier', label: '供应商', children: display(item.supplier_name) },
            { key: 'each', label: '单份数量', children: display(item.quantity_per_unit) },
            { key: 'unit', label: '数量单位', children: display(item.quantity_unit) },
            { key: 'count', label: '份数', children: display(item.unit_count) },
            { key: 'total', label: '总体数量', children: display(item.total_quantity) },
            { key: 'notes', label: '明细备注', children: display(item.notes) },
          ]} />
          <ProductDetails value={item} />
        </>,
      }))}
    />
  </section>
}
