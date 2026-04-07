const Keyword = require('../models/Keyword');

async function getRandomKeyword() {
  const count = await Keyword.countDocuments();
  if (count === 0) {
    // Default fallback
    return {
      _id: 'default',
      civilianKeyword: 'Mặt Trời',
      spyKeyword: 'Đèn',
      civilianDescription: 'Nguồn sáng tự nhiên lớn nhất trong hệ mặt trời',
      spyDescription: 'Vật phát sáng nhân tạo dùng trong nhà',
    };
  }
  const skip = Math.floor(Math.random() * count);
  return Keyword.findOne({}).skip(skip);
}

async function getAllKeywords() {
  return Keyword.find({});
}

async function addKeyword(pair) {
  return Keyword.create(pair);
}

async function deleteKeyword(id) {
  return Keyword.findByIdAndDelete(id);
}

async function countKeywords() {
  return Keyword.countDocuments();
}

async function seedKeywords() {
  const count = await Keyword.countDocuments();
  if (count > 0) return;

  const pairs = [
    // Địa điểm
    { civilianKeyword: "Bãi biển", spyKeyword: "Hồ bơi", civilianDescription: "Nơi có nhiều cát, sóng biển và ánh nắng mặt trời.", spyDescription: "Nơi có làn nước trong xanh, thường nằm trong khuôn viên nhà hoặc khách sạn.", category: "địa điểm" },
    { civilianKeyword: "Siêu thị", spyKeyword: "Chợ", civilianDescription: "Nơi mua sắm hiện đại với xe đẩy và máy tính tiền.", spyDescription: "Nơi mua sắm truyền thống, thường họp vào buổi sáng với tiếng trả giá.", category: "địa điểm" },
    { civilianKeyword: "Bệnh viện", spyKeyword: "Phòng khám", civilianDescription: "Cơ sở y tế lớn với nhiều khoa và giường bệnh.", spyDescription: "Cơ sở y tế quy mô nhỏ, thường do bác sĩ tư nhân quản lý.", category: "địa điểm" },
    { civilianKeyword: "Trường học", spyKeyword: "Trung tâm học", civilianDescription: "Nơi học sinh đến học tập chính quy mỗi ngày.", spyDescription: "Nơi học thêm các kỹ năng hoặc kiến thức bổ trợ ngoài giờ.", category: "địa điểm" },
    { civilianKeyword: "Sân bay", spyKeyword: "Bến tàu", civilianDescription: "Nơi những con chim sắt khổng lồ cất cánh và hạ cánh.", spyDescription: "Nơi những con tàu cập bến để đón trả khách trên mặt nước.", category: "địa điểm" },
    { civilianKeyword: "Rạp chiếu phim", spyKeyword: "Nhà hát", civilianDescription: "Nơi thưởng thức những bộ phim bom tấn trên màn hình lớn.", spyDescription: "Nơi diễn ra các buổi biểu diễn nghệ thuật trực tiếp trên sân khấu.", category: "địa điểm" },
    { civilianKeyword: "Công viên", spyKeyword: "Vườn thực vật", civilianDescription: "Không gian xanh công cộng cho mọi người vui chơi, tập thể dục.", spyDescription: "Nơi bảo tồn và trưng bày nhiều loài cây quý hiếm.", category: "địa điểm" },
    { civilianKeyword: "Khách sạn", spyKeyword: "Nhà nghỉ", civilianDescription: "Nơi lưu trú cao cấp với đầy đủ dịch vụ tiện nghi.", spyDescription: "Nơi dừng chân nghỉ ngơi đơn giản với giá cả bình dân.", category: "địa điểm" },
    { civilianKeyword: "Nhà hàng", spyKeyword: "Quán ăn", civilianDescription: "Không gian ẩm thực sang trọng với thực đơn phong phú.", spyDescription: "Địa điểm ăn uống gần gũi, phục vụ các món ăn đơn giản.", category: "địa điểm" },
    { civilianKeyword: "Thư viện", spyKeyword: "Nhà sách", civilianDescription: "Nơi mượn sách và học tập trong không gian yên tĩnh.", spyDescription: "Nơi trưng bày và bán các loại sách mới cho mọi người.", category: "địa điểm" },
    // Đồ vật
    { civilianKeyword: "Điện thoại", spyKeyword: "Máy tính bảng", civilianDescription: "Thiết bị liên lạc nhỏ gọn luôn mang theo bên mình.", spyDescription: "Thiết bị điện tử màn hình lớn, hỗ trợ làm việc và giải trí.", category: "đồ vật" },
    { civilianKeyword: "Xe đạp", spyKeyword: "Xe máy", civilianDescription: "Phương tiện di chuyển hai bánh chạy bằng sức người.", spyDescription: "Phương tiện di chuyển hai bánh chạy bằng động cơ xăng hoặc điện.", category: "đồ vật" },
    { civilianKeyword: "Bàn phím", spyKeyword: "Chuột máy tính", civilianDescription: "Dụng cụ dùng để nhập dữ liệu bằng các phím bấm.", spyDescription: "Dụng cụ dùng để điều khiển con trỏ trên màn hình máy tính.", category: "đồ vật" },
    { civilianKeyword: "Tivi", spyKeyword: "Màn hình máy tính", civilianDescription: "Thiết bị giải trí gia đình dùng để xem các chương trình truyền hình.", spyDescription: "Thiết bị hiển thị hình ảnh từ bộ xử lý trung tâm.", category: "đồ vật" },
    { civilianKeyword: "Máy giặt", spyKeyword: "Máy sấy", civilianDescription: "Thiết bị giúp làm sạch quần áo bằng nước và xà phòng.", spyDescription: "Thiết bị giúp làm khô quần áo nhanh chóng sau khi giặt.", category: "đồ vật" },
    { civilianKeyword: "Nồi cơm điện", spyKeyword: "Lò vi sóng", civilianDescription: "Vật dụng không thể thiếu để nấu chín hạt gạo.", spyDescription: "Thiết bị dùng sóng điện từ để hâm nóng thức ăn cực nhanh.", category: "đồ vật" },
    { civilianKeyword: "Bàn chải đánh răng", spyKeyword: "Bàn chải tóc", civilianDescription: "Dụng cụ vệ sinh cá nhân giúp bảo vệ hàm răng trắng sáng.", spyDescription: "Dụng cụ giúp gỡ rối và làm mượt những sợi tóc.", category: "đồ vật" },
    { civilianKeyword: "Ví tiền", spyKeyword: "Túi xách", civilianDescription: "Vật dụng nhỏ gọn dùng để đựng tiền và các loại thẻ.", spyDescription: "Phụ kiện thời trang dùng để đựng nhiều đồ dùng cá nhân khi ra ngoài.", category: "đồ vật" },
    { civilianKeyword: "Kính mắt", spyKeyword: "Kính áp tròng", civilianDescription: "Phụ kiện đeo trên mặt để hỗ trợ thị lực hoặc thời trang.", spyDescription: "Miếng nhựa mỏng đặt trực tiếp lên con ngươi để nhìn rõ hơn.", category: "đồ vật" },
    { civilianKeyword: "Máy ảnh", spyKeyword: "Điện thoại chụp ảnh", civilianDescription: "Thiết bị chuyên dụng dùng để lưu lại những khoảnh khắc đẹp.", spyDescription: "Tính năng phổ biến trên smartphone dùng để ghi hình.", category: "đồ vật" },
    // Động vật
    { civilianKeyword: "Chó", spyKeyword: "Mèo", civilianDescription: "Loài vật trung thành, thường được coi là người bạn tốt của con người.", spyDescription: "Loài vật kiêu kỳ, thích bắt chuột và thích được vuốt ve.", category: "động vật" },
    { civilianKeyword: "Sư tử", spyKeyword: "Hổ", civilianDescription: "Chúa tể sơn lâm với chiếc bờm oai vệ.", spyDescription: "Loài thú săn mồi dũng mãnh với bộ lông vằn đặc trưng.", category: "động vật" },
    { civilianKeyword: "Cá heo", spyKeyword: "Cá mập", civilianDescription: "Loài động vật biển thông minh, thân thiện với con người.", spyDescription: "Sát thủ đại dương với hàm răng sắc nhọn và khứu giác nhạy bén.", category: "động vật" },
    { civilianKeyword: "Đại bàng", spyKeyword: "Diều hâu", civilianDescription: "Chúa tể bầu trời với đôi mắt tinh anh và sải cánh rộng.", spyDescription: "Loài chim săn mồi cỡ trung, bay lượn rất linh hoạt.", category: "động vật" },
    { civilianKeyword: "Voi", spyKeyword: "Tê giác", civilianDescription: "Động vật trên cạn lớn nhất với chiếc vòi dài.", spyDescription: "Loài thú lớn với lớp da dày và chiếc sừng trên mũi.", category: "động vật" },
    { civilianKeyword: "Thỏ", spyKeyword: "Sóc", civilianDescription: "Loài vật gặm nhấm có đôi tai dài và thích ăn cà rốt.", spyDescription: "Loài vật nhỏ bé nhanh nhẹn, thích leo trèo và ăn hạt dẻ.", category: "động vật" },
    { civilianKeyword: "Gà", spyKeyword: "Vịt", civilianDescription: "Loài gia cầm gáy báo thức vào mỗi buổi sáng.", spyDescription: "Loài gia cầm thích bơi lội và có tiếng kêu cạp cạp.", category: "động vật" },
    { civilianKeyword: "Rắn", spyKeyword: "Thằn lằn", civilianDescription: "Loài bò sát không chân, di chuyển bằng cách trườn.", spyDescription: "Loài bò sát nhỏ có bốn chân, thường leo trèo trên tường.", category: "động vật" },
    { civilianKeyword: "Cua", spyKeyword: "Tôm", civilianDescription: "Loài thủy sinh có lớp vỏ cứng và hai chiếc càng to.", spyDescription: "Loài thủy sinh thân mềm hơn, có nhiều chân và bơi lùi.", category: "động vật" },
    { civilianKeyword: "Bướm", spyKeyword: "Ong", civilianDescription: "Loài côn trùng có đôi cánh rực rỡ sắc màu.", spyDescription: "Loài côn trùng chăm chỉ hút mật và có thể châm đốt.", category: "động vật" },
    // Đồ ăn
    { civilianKeyword: "Phở", spyKeyword: "Bún bò", civilianDescription: "Món ăn quốc hồn quốc túy của Việt Nam với nước dùng thanh ngọt.", spyDescription: "Món bún đặc sản miền Trung với vị cay nồng và mùi mắm ruốc.", category: "đồ ăn" },
    { civilianKeyword: "Cơm tấm", spyKeyword: "Cơm chiên", civilianDescription: "Món cơm bình dân ăn kèm với sườn nướng và bì chả.", spyDescription: "Món cơm được đảo trên chảo nóng cùng với trứng và các loại gia vị.", category: "đồ ăn" },
    { civilianKeyword: "Bánh mì", spyKeyword: "Bánh bao", civilianDescription: "Món ăn đường phố nổi tiếng thế giới của người Việt.", spyDescription: "Món bánh hấp mềm mại với nhân thịt và trứng cút bên trong.", category: "đồ ăn" },
    { civilianKeyword: "Pizza", spyKeyword: "Hamburger", civilianDescription: "Món bánh tròn của Ý với lớp phô mai tan chảy.", spyDescription: "Món bánh kẹp thịt kiểu Mỹ rất phổ biến toàn cầu.", category: "đồ ăn" },
    { civilianKeyword: "Sushi", spyKeyword: "Ramen", civilianDescription: "Tinh hoa ẩm thực Nhật Bản với cá sống và cơm giấm.", spyDescription: "Món mì nước đậm đà trứ danh của xứ sở hoa anh đào.", category: "đồ ăn" },
    { civilianKeyword: "Kem", spyKeyword: "Chè", civilianDescription: "Món tráng miệng mát lạnh tan chảy trong miệng.", spyDescription: "Món ăn ngọt truyền thống với nhiều loại đậu và nước cốt dừa.", category: "đồ ăn" },
    { civilianKeyword: "Cà phê", spyKeyword: "Trà sữa", civilianDescription: "Thức dùng giúp tỉnh táo vào mỗi buổi sáng.", spyDescription: "Thức uống giải khát yêu thích của giới trẻ với các loại topping.", category: "đồ ăn" },
    { civilianKeyword: "Nước cam", spyKeyword: "Nước chanh", civilianDescription: "Thức uống giàu vitamin C, có màu vàng cam rực rỡ.", spyDescription: "Thức uống giải nhiệt có vị chua đặc trưng.", category: "đồ ăn" },
    { civilianKeyword: "Xoài", spyKeyword: "Dứa", civilianDescription: "Loại trái cây nhiệt đới ngọt lịm khi chín.", spyDescription: "Loại trái cây có nhiều mắt và hương thơm rất mạnh.", category: "đồ ăn" },
    { civilianKeyword: "Chocolate", spyKeyword: "Kẹo cao su", civilianDescription: "Món kẹo ngọt ngào làm từ hạt ca cao.", spyDescription: "Loại kẹo dùng để nhai nhưng không được nuốt.", category: "đồ ăn" },
  ];

  await Keyword.insertMany(pairs);
  console.log(`[KeywordService] Seeded ${pairs.length} keyword pairs from Java version.`);
}

module.exports = { getRandomKeyword, getAllKeywords, addKeyword, deleteKeyword, countKeywords, seedKeywords };
