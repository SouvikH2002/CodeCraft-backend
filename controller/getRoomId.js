const getRoomId = async (req, res) => {
  console.log(req)
  return res.status(200).json({roomID:123456})
}

export {getRoomId}
